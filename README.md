# Chit-Chat: Secure, Offline-First Messenger

Chit-Chat is a modern, high-performance messaging application built with a FastAPI backend and a React Native frontend. It features an offline-outbox pattern, end-to-end encryption (E2EE) plumbing, presence tracking, and a robust media pipeline.

---

## 🚀 Key Features

### 📱 Mobile (React Native)
- **Offline Outbox**: Messages are enqueued in a local SQLite database and synchronized via WebSocket when a connection is available.
- **E2EE Identity**: On-device keypair generation (Ed25519/X25519) stored securely in the OS Keystore/Keychain.
- **Media Pipeline**: Automatic image/video compression, chunked uploads to S3-compatible storage (R2), and local LRU caching.
- **Rich Content**: Support for Text, Stickers, GIFs (Giphy), and Link Previews.
- **Adaptive UI**: Light/Dark mode support, message search, and a smooth FlatList experience.

### ⚙️ Backend (FastAPI)
- **WebSocket Synchronization**: Real-time message delivery with fallback REST sync for offline users.
- **Presence Engine**: Live online/offline status broadcasting and last-seen tracking.
- **Secure Auth**: JWT-based authentication with refresh token rotation and passcode-protected accounts.
- **Robust Media**: Multipart upload handling for large files and SSRF-protected link preview generation.

---

## 🛠 Tech Stack

| Component | Technology |
|---|---|
| **Frontend** | React Native (0.86), TypeScript, SQLite (Quick-SQLite), Keychain |
| **Backend** | Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL/SQLite |
| **Infrastructure** | Render (API), Cloudflare R2 (Media), Firebase (Push) |
| **Security** | Libsodium (TweetNaCl on mobile), Ed25519, X25519, JWT |

---

## 📖 Architecture & Logic

### Message Delivery (Offline-First)
The app uses an **Idempotent Outbox Pattern**:
1. Messages are written to local SQLite first.
2. A WebSocket attempts to flush pending messages.
3. Each message has a `client_id` generated on the device.
4. If a connection drops, the client resends with the same `client_id`.
5. The backend checks for existing `client_id` to prevent duplicate rows.

### Presence & Read Receipts
- **Presence**: When a WebSocket connects, the server broadcasts an `online` event. On disconnect, it broadcasts `last_seen`.
- **Read Receipts**: When a message enters the viewport, the client enqueues a `read` receipt. These are synced back to the sender live or via a catch-up endpoint (`/messages/sent-status`).

### Security Model
- **Identity**: Devices generate an Ed25519 signing key (Identity) and an X25519 encryption key (Prekey).
- **Storage**: Private keys are stored in `react-native-keychain` and never leave the device.
- **Note**: Currently, message content is transmitted as `base64(JSON)`. The identity plumbing is ready, but the full X3DH handshake/ratcheting is the next major milestone.

---

## 🚦 Getting Started

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env      # Configure your JWT_SECRET and Database
alembic upgrade head
python -m app.seed        # Create default dev accounts
uvicorn app.main:app --reload
```

### 2. Frontend Setup
```bash
cd app
npm install
# Configure API_BASE_URL in src/config.ts
npx react-native run-android  # Or run-ios
```

---

## 📝 Configuration (Environment Variables)

### Backend (`backend/.env`)
- `DATABASE_URL`: Connection string for your DB.
- `JWT_SECRET`: Used to sign authentication tokens.
- `FIREBASE_CREDENTIALS_FILE`: Path to service-account.json for push notifications.
- `R2_ACCESS_KEY_ID`: Cloudflare R2 credentials for media storage.

### Frontend (`app/src/config.ts`)
- `API_BASE_URL`: Point this to your live Render URL or local IP (e.g., `http://10.0.2.2:8000` for Android Emulator).
- `GIPHY_API_KEY`: Required for GIF search functionality.

---

## 📦 Deployment

### Backend
The backend is designed for containerized or PaaS deployment (like Render/Fly.io).
- Ensure `alembic upgrade head` runs during the build step.
- Set up a managed PostgreSQL instance for production.

### Android APK
1. Configure `app/android/keystore.properties` with your release key.
2. Run `./gradlew assembleRelease` in the `app/android` directory.

---

## 🐞 Troubleshooting
- **Cold Starts**: On Render's free tier, the first request may take ~60s.
- **Native Modules**: If `Keychain` or `SQLite` fail to link, ensure you've opened the `/app/android` folder directly in Android Studio to trigger a full Gradle sync.
