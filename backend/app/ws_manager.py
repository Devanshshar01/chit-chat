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
        self._active: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self._active[user_id] = ws

    def disconnect(self, user_id: str):
        self._active.pop(user_id, None)

    def is_online(self, user_id: str) -> bool:
        return user_id in self._active

    def online_user_ids(self) -> set[str]:
        return set(self._active.keys())

    async def push(self, user_id: str, payload: dict) -> bool:
        """Returns True if actually delivered live, False if recipient offline."""
        ws = self._active.get(user_id)
        if ws is None:
            return False
        try:
            await ws.send_json(payload)
            return True
        except Exception:
            # connection died without a clean disconnect event
            self.disconnect(user_id)
            return False

    async def broadcast_to_others(self, all_user_ids: list[str], sender_id: str, payload: dict) -> None:
        """Pushes to everyone currently online except sender_id. Fine for a 2-user
        app today; for more users this is still correct, just not optimized."""
        for uid in all_user_ids:
            if uid != sender_id:
                await self.push(uid, payload)


manager = ConnectionManager()
