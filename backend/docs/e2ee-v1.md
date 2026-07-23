# E2EE v1 backend contract

This backend only stores and relays public key material plus opaque encrypted
envelopes. It must never receive private keys, shared secrets, plaintext,
plaintext-derived previews, or Double Ratchet state.

## Scope

- Legacy protocol v0 remains available for existing clients and test rows.
- Protocol v1 is device-scoped. Each logged-in device receives a device-bound
  access token claim, `did`.
- X3DH setup and Double Ratchet encryption/decryption are client-side work.
  The PWA/native client should use an audited browser-compatible protocol
  implementation rather than handwritten cryptographic primitives.

## Device key setup

1. `PUT /keys/me/device-bundle`
   Publishes the authenticated device's public X3DH bundle:
   Ed25519 identity signing public key, X25519 identity DH public key,
   signed X25519 prekey, signed prekey id, and Ed25519 signature.

2. `PUT /keys/me/one-time-prekeys`
   Appends up to 100 public X25519 one-time prekeys for the authenticated
   device. Duplicate uploads with identical public keys are idempotent.
   Reusing a key id with different key material is rejected.

3. `GET /keys/{username}/devices`
   Lists active devices that have published v1 bundles.

4. `POST /keys/{username}/devices/{device_id}/claim-prekey-bundle`
   Returns the target device public bundle and atomically consumes at most one
   available one-time prekey. If no one-time prekey is available, the response
   still returns the signed prekey bundle so X3DH fallback can be handled by
   the client.

## Message relay

Clients send WebSocket envelopes with `type: "encrypted_message"` and protocol
version `1`. The server persists the opaque ciphertext and relay-safe header:

- sender device id from the access token
- recipient device id
- session id
- ratchet public key
- message number
- previous chain length
- nonce
- optional initial prekey header

The server routes the envelope only to the recipient device. Offline sync with
`GET /messages/sync` returns v1 messages only to the matching device-bound
token. Legacy tokens only receive protocol v0 messages.

## Privacy tradeoffs

Search, link previews, and media captions must be client-side encrypted data in
v1. The server can store encrypted preview blobs later, but it must not fetch
URLs or index plaintext for encrypted chats.

## Multi-device behavior

Each device has its own X3DH bundle and ratchet session. A sender that wants a
conversation available across multiple recipient devices must encrypt one
envelope per recipient device. To show sent messages on the sender's other
devices, the client should also create encrypted self-copy envelopes for those
devices.