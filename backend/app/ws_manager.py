"""
Tracks which users currently have a live WebSocket connection, so the
message send path knows whether to push in real time or just leave the
message for the recipient to pick up on next sync - and now also so
presence changes (online/offline) can be broadcast to everyone else.

One connection per user for now (not per-device) - multi-device fan-out
is real work that belongs to its own step, not smuggled in here.
"""
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._active: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, user_id: str, connection_id: str, ws: WebSocket):
        await ws.accept()
        self._active.setdefault(user_id, {})[connection_id] = ws

    def disconnect(self, user_id: str, connection_id: str):
        connections = self._active.get(user_id)
        if connections is None:
            return
        connections.pop(connection_id, None)
        if not connections:
            self._active.pop(user_id, None)

    def is_online(self, user_id: str) -> bool:
        return bool(self._active.get(user_id))

    def online_user_ids(self) -> set[str]:
        return set(self._active.keys())

    async def push(self, user_id: str, payload: dict) -> bool:
        """Deliver a legacy/user-scoped event to every live device socket."""
        connections = dict(self._active.get(user_id, {}))
        if not connections:
            return False
        delivered = False
        for connection_id, ws in connections.items():
            try:
                await ws.send_json(payload)
                delivered = True
            except Exception:
                self.disconnect(user_id, connection_id)
        return delivered

    async def push_device(self, user_id: str, device_id: str, payload: dict) -> bool:
        """Deliver an E2EE envelope only to its intended recipient device."""
        ws = self._active.get(user_id, {}).get(device_id)
        if ws is None:
            return False
        try:
            await ws.send_json(payload)
            return True
        except Exception:
            self.disconnect(user_id, device_id)
            return False

    async def broadcast_to_others(self, all_user_ids: list[str], sender_id: str, payload: dict) -> None:
        """Pushes to everyone currently online except sender_id. Fine for a 2-user
        app today; for more users this is still correct, just not optimized."""
        for uid in all_user_ids:
            if uid != sender_id:
                await self.push(uid, payload)


manager = ConnectionManager()
