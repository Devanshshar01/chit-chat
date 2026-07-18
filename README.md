# unnamed-chat

## Status (as of this build)

| Step | What | Status |
|---|---|---|
| 1 | Backend foundation (FastAPI, schema, Alembic migrations, error handling) | **Done, tested** |
| 2 | User seeding + passcode auth (JWT access/refresh) | **Done, tested** |
| 3 | Crypto identity (libsodium) - server verification + client keygen | **Backend tested.** Client identity module type-checks and bundles clean against the real RN project (see below) - not run on a device/emulator. |
| 4 | Offline outbox pattern (WebSocket + idempotent delivery + sync pull) | **Backend fully tested** (live delivery, dropped-connection retry produces no duplicate, offline queue + catch-up sync all verified against a running server). Client outbox module type-checks and bundles clean - not run on a device. |
| 5 | Core chat UI | **Real RN 0.86 project scaffolded** (`app/`), all deps installed via npm, login + chat thread screens wired to the crypto/outbox modules, `npx tsc --noEmit` clean, **Metro successfully bundled the whole app for Android** (4.7MB bundle, confirmed our code is actually in it). **Not run on a device/emulator** - no Android SDK in this sandbox, so native module linking (Keychain, SQLite) is unverified and there's no visual to show you. |
| 6 | Media pipeline (compression, chunked upload to R2, local caching + eviction) | **Backend fully tested end-to-end against a local mock S3 server** - both the small-file (single PUT) and large-file (multipart, 3 real chunks) paths verified byte-perfect round trip, plus edge cases (double-complete, complete-without-upload, missing media all correctly rejected). **Client (compression + chunked uploader + LRU cache) type-checks and bundles clean** - not run on a device, and compression/caching behavior specifically depends on native RNFS/compressor behavior this sandbox can't execute. |
| 7 | Stickers, GIFs, link previews | **Link previews: backend fully tested** - real OG-tag fetch+parse verified against a live URL (github.com), caching verified, and SSRF protection verified against 4 real attack URLs (localhost, link-local metadata endpoint, private IP, internal port). **Stickers: built-in emoji pack, no external assets/licensing** - type-checks and bundles clean. **GIF search: written against Giphy's current documented API schema (checked their docs directly), but never executed** - `api.giphy.com` isn't reachable from this sandbox's network, so this is unverified by execution, same caveat as the RN native modules. Needs your own Giphy API key in `app/src/config.ts`. |
| 8 | Presence + ticks (online/last-seen, sent/delivered/read state machine) | **Backend fully tested end-to-end**: presence broadcasts on connect/disconnect (verified live over two real WebSocket connections), REST presence lookup, read receipts (verified live push to the sender, plus offline catch-up via a new `/messages/sent-status` endpoint when the sender wasn't connected when the read happened), and a security check (a message's sender cannot mark their own sent message "read" - verified rejected). **Client (presence header, delivery ticks, mark-as-read-on-view) type-checks and bundles clean** - not run on a device. |
| 9-13 | Push notifications, crash resilience, polish, APK build, calling | **Not started** |

**Two real bugs found and fixed while building step 8, both worth knowing about:**
1. Adding `last_seen_at` as a NOT NULL column would have broken the
   migration the moment it ran against your actual database (which
   already has the two seeded users in it, same as everyone's real
   setup) - SQLite refuses to add a NOT NULL column with no constant
   default to a populated table. Caught by testing the migration against
   a database with a pre-existing row (not just a fresh one), not by
   reading the code. Fixed by making the column nullable.
2. The client's `sent-status` catch-up cursor had an off-by-one: naively
   advancing it to "now" after each fetch would let old, still-unread
   sent messages age out of the catch-up query forever once their
   `created_at` fell behind the cursor - a read receipt on a message
   from days ago could be silently missed. Fixed by pinning the cursor
   to just-before the oldest still-unread message, verified with real
   date arithmetic in Node and a live API call confirming the backend
   accepts that exact timestamp format.

**Bug found and fixed while building step 7:** SQLite strips timezone
info when reading back a `DateTime(timezone=True)` column through
aiosqlite, which broke any Python-level comparison against a fresh
`datetime.now(timezone.utc)`. This silently broke `/auth/refresh`
(nobody would've hit it until an access token actually expired) and
would have broken the new link-preview cache TTL check on its first
cache hit. Fixed with a small `ensure_utc()` helper in `app/utils.py`,
applied to both, and both are now verified working. Worth knowing this
pattern exists if you add more datetime comparisons later.

**Important caveat, still true:** message content is sent as
`base64(JSON)`, not actually encrypted. Step 3 built the identity/
key-exchange plumbing (Ed25519 identity key + signed X25519 prekey) but
not the part that turns a key exchange into an actual shared secret and
uses it to encrypt message bytes (that's an X3DH-style handshake + a
ratchet - real cryptographic work, not something to fake). Don't mistake
this build for end-to-end encrypted yet.

Everything marked "tested" was actually run: server started, real libsodium
keypairs generated, valid signatures accepted, a forged signature rejected,
key exchange performed between the two seeded accounts, wrong-passcode
login rejected, messages sent live between two connected WebSocket clients,
a same-`client_id` retry proven to produce zero duplicate rows, an offline
message correctly queued then picked up via the sync endpoint, and the
full RN app installed and bundled without errors. Nothing here is
placeholder code pretending to work - what's unverified is *labeled*
unverified.

## Why steps 9-13 aren't in this drop

Each of those needs either a real device/emulator to verify against (RN
UI, push notifications, APK signing) or meaningfully large surface area
(media pipeline, offline sync engine) where writing it without running it
would just mean shipping you bugs formatted as code. Better to build them
incrementally, in order, each verified before the next depends on it -
same as what just happened with steps 1-3.

## Running the backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# edit .env: set JWT_SECRET, and the two SEED_*_PASSCODE vars

alembic upgrade head       # builds the schema from tracked migrations
python -m app.seed         # creates devansh + swarnima accounts

uvicorn app.main:app --reload
# -> http://localhost:8000/health should return {"status": "ok"}
```

Endpoints live:
- `POST /auth/login` - `{username, passcode, device_name}` -> access + refresh tokens
- `POST /auth/refresh` - rotates a refresh token
- `POST /auth/logout` - revokes a refresh token
- `GET /users/me` / `GET /users/{username}` - requires `Authorization: Bearer <access_token>`
- `PUT /keys/me` - publish this device's public key bundle (signature verified server-side)
- `GET /keys/{username}` - fetch someone else's public key bundle
- `WS /ws?token=<access_token>` - send `{client_id, recipient_username, ciphertext}`, get an ack back; live-pushed to the recipient if they're connected
- `GET /messages/sync?since=<ISO timestamp>` - pull anything addressed to you since a cursor (offline catch-up)
- `POST /media/uploads` - `{filename, content_type, total_size_bytes}` -> either a single presigned PUT url (small files) or a list of presigned multipart PUT urls (large files)
- `POST /media/uploads/{media_id}/complete` - `{parts: [{part_number, etag}]}` (empty array for the simple path) -> verifies the object landed in the bucket, returns a presigned GET url
- `GET /media/{media_id}` - metadata + a fresh presigned GET url if ready
- `POST /link-preview` - `{url}` -> `{title, description, image_url, available}`. SSRF-guarded (rejects private/loopback/link-local IPs) and cached (7 days on success, 1 hour on failure).
- `GET /users/{username}/presence` - `{username, is_online, last_seen_at}`
- `GET /messages/sent-status?since=<ISO timestamp>` - catches up a sender on `delivered_at`/`read_at` changes to their own sent messages missed while offline
- `WS` messages now use explicit envelope types: `{"type": "message", ...}` to send, `{"type": "read", "message_ids": [...]}` to mark messages read. The server pushes `{"type": "presence", ...}` on peer connect/disconnect and `{"type": "read_receipt", ...}` when a sent message gets read.

## Testing the media pipeline without real R2

Real R2 needs an actual Cloudflare account/bucket, which this build never
had access to. Instead, the media pipeline was verified against a local
mock S3 server (moto) - same boto3 code path, just a different endpoint:

```bash
pip install -r requirements-dev.txt
python -m moto.server -H 127.0.0.1 -p 5000   # separate terminal, leave running

# create the bucket once (moto starts empty)
python3 -c "
import boto3
from botocore.config import Config
c = boto3.client('s3', endpoint_url='http://127.0.0.1:5000',
    aws_access_key_id='test', aws_secret_access_key='test',
    region_name='us-east-1', config=Config(signature_version='s3v4'))
c.create_bucket(Bucket='unnamed-chat-media')
"

S3_ENDPOINT_URL_OVERRIDE=http://127.0.0.1:5000 uvicorn app.main:app --reload
```

Swap in real R2 credentials in `.env` (unset `S3_ENDPOINT_URL_OVERRIDE`)
and the exact same code talks to the real thing - R2 is S3-compatible,
that's the entire point of building it this way.

## Client (steps 3-8)

```bash
cd app
npm install
npx react-native run-android   # needs an emulator or connected device
# or
npx react-native run-ios       # needs Xcode, macOS
```

Point `app/src/api/client.ts`'s `API_BASE_URL` at wherever the backend is
actually reachable from your device/emulator (`http://10.0.2.2:8000` for
the Android emulator talking to a host machine, not `localhost`).

`app/src/crypto/identity.ts` - on-device Ed25519 identity + X25519 prekey
generation, stored via `react-native-keychain`.

`app/src/outbox/db.ts` + `app/src/outbox/outboxManager.ts` - local SQLite
outbox queue, WebSocket lifecycle with reconnect backoff, ack handling,
REST sync fallback. Now also: presence push handling, `markAsRead()`
(sends a read receipt over the socket), local `delivered_at`/`read_at`
tracking per message, and a second REST catch-up
(`/messages/sent-status`) for read receipts missed while offline.

`app/src/media/compress.ts` - image/video compression before upload
(`react-native-compressor`).

`app/src/media/uploader.ts` - chunked uploader matching the backend's
exact contract: reads the file in slices via `react-native-fs`, does the
single-PUT or multipart dance depending on what the backend says, reports
progress.

`app/src/media/cache.ts` - downloads media to a local cache dir, tracks
size/last-access in SQLite, evicts least-recently-used files once the
500MB cap is hit.

`app/src/api/client.ts` - typed fetch wrapper for every backend endpoint.

`app/src/messages/content.ts` - the message content schema (text, sticker,
gif, link) and encode/decode - this is what actually goes into the
outbox's `ciphertext` field for now, JSON wrapped in base64 (see the
encryption caveat above). Also decodes step 5's older plain-base64
messages as a text fallback so nothing already sent becomes unreadable.

`app/src/media/stickers.ts` - built-in emoji sticker pack, no external
assets.

`app/src/media/gifSearch.ts` - Giphy search/trending wrapper. **Needs a
real API key in `app/src/config.ts`** (get one free at
developers.giphy.com) - written against Giphy's current documented
schema but never executed, since `api.giphy.com` isn't reachable from
this sandbox.

`app/src/config.ts` - the one place holding values only you can fill in
(currently just `GIPHY_API_KEY`).

`app/src/screens/StickerPicker.tsx` + `GifPicker.tsx` - the two picker
sheets, wired into `ChatScreen.tsx`'s toolbar.

`app/src/screens/LoginScreen.tsx` + `ChatScreen.tsx` - now renders four
message types (text, sticker, gif, link-preview-card), detects a URL in
typed text to attach a preview automatically before sending, shows the
peer's online/last-seen status in the header, marks incoming messages
read the moment they're visible on screen, and renders sent/delivered/read
ticks on outgoing messages. Not yet wired to the media pipeline (step 6) -
that's attaching a photo/video from the chat screen, still open.

## Schema changes going forward

Don't hand-edit tables. Change `app/models.py`, then:
```bash
alembic revision --autogenerate -m "description of the change"
alembic upgrade head
```
Check the generated migration file before running it - autogenerate is a
first draft, not gospel.

## Next step

Same three priorities as before, still unaddressed and growing more
important as the app grows:
1. Get a real Giphy API key into `app/src/config.ts` and actually run the
   GIF search on a device - it's the one piece of step 7 with zero
   execution verification at all.
2. Real device/emulator verification of everything native - Keychain,
   quick-sqlite, compressor, RNFS - autolinking *should* handle it but
   that's unverified until it runs once.
3. The actual encryption layer (shared secret derivation + message
   encryption), so steps 5-8's chat UI is protecting something instead
   of moving `base64(JSON)` around. Step 9 (push notifications) will need
   to decide what a notification payload can safely contain without a
   plaintext preview leaking through a lock screen - answering that
   cleanly gets a lot easier once encryption exists, so this is worth
   doing before, not after.
