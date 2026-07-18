/**
 * On-device identity keypair generation + secure storage.
 *
 * Mirrors exactly what the backend verifies in app/crypto.py:
 *   - identity key   = Ed25519 signing keypair (long-term)
 *   - signed prekey  = X25519 encryption keypair, signed by the identity key
 *
 * Private keys NEVER leave this file's storage calls - they go straight
 * into the OS keystore (Keychain on iOS, Keystore-backed on Android via
 * react-native-keychain) and are never sent to the API or logged.
 *
 * Dependencies (add to the RN app, not yet installed anywhere - this is
 * step 3's client half, written against library APIs but not yet run
 * against a real RN bundler in this session):
 *   npm install libsodium-wrappers react-native-keychain
 *
 * libsodium-wrappers needs its WASM ready() awaited before use - that's
 * why every exported function here is async.
 */
import sodium from "libsodium-wrappers";
import * as Keychain from "react-native-keychain";

const KEYCHAIN_SERVICE = "unnamed-chat.identity";

export interface PublicKeyBundle {
  identityKeyPublic: string;   // base64
  signedPrekeyPublic: string;  // base64
  prekeySignature: string;     // base64
}

interface StoredPrivateKeys {
  identitySecretKey: string; // base64
  prekeySecretKey: string;   // base64
}

async function ready(): Promise<typeof sodium> {
  await sodium.ready;
  return sodium;
}

/**
 * Generates a fresh identity + prekey pair, stores the private halves in
 * the OS keystore, and returns the public halves ready to PUT to
 * /keys/me. Call this exactly once per device, the first time the app
 * runs after login - not on every launch.
 */
export async function generateAndStoreIdentity(): Promise<PublicKeyBundle> {
  const s = await ready();

  const identityKeyPair = s.crypto_sign_keypair();       // Ed25519
  const prekeyPair = s.crypto_box_keypair();              // X25519

  // sign the prekey's public bytes with the identity secret key
  const signature = s.crypto_sign_detached(
    prekeyPair.publicKey,
    identityKeyPair.privateKey
  );

  const toStore: StoredPrivateKeys = {
    identitySecretKey: s.to_base64(identityKeyPair.privateKey),
    prekeySecretKey: s.to_base64(prekeyPair.privateKey),
  };

  await Keychain.setInternetCredentials(
    KEYCHAIN_SERVICE,
    "identity",
    JSON.stringify(toStore)
  );

  return {
    identityKeyPublic: s.to_base64(identityKeyPair.publicKey),
    signedPrekeyPublic: s.to_base64(prekeyPair.publicKey),
    prekeySignature: s.to_base64(signature),
  };
}

/** True if this device has already generated an identity. */
export async function hasStoredIdentity(): Promise<boolean> {
  const creds = await Keychain.getInternetCredentials(KEYCHAIN_SERVICE);
  return creds !== false;
}

/**
 * Loads this device's own private keys back out of secure storage.
 * Needed later (step 4+) to decrypt incoming messages / do the
 * encryption handshake against a peer's public prekey.
 */
export async function loadStoredIdentity(): Promise<StoredPrivateKeys | null> {
  const creds = await Keychain.getInternetCredentials(KEYCHAIN_SERVICE);
  if (creds === false) return null;
  return JSON.parse(creds.password) as StoredPrivateKeys;
}

/**
 * Wipes local identity keys. This is destructive - anyone who had this
 * device's public key on file can no longer complete a handshake with
 * it until a new bundle is generated and re-published.
 */
export async function clearStoredIdentity(): Promise<void> {
  await Keychain.resetInternetCredentials({ server: KEYCHAIN_SERVICE });
}
