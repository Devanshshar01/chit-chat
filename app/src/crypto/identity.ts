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
 * Uses tweetnacl (pure JS) rather than libsodium-wrappers: Hermes has no
 * WebAssembly, so libsodium's WASM build cannot run on-device. tweetnacl
 * produces the same Ed25519/X25519 key formats (64-byte signing secret
 * key, 32-byte public keys, 64-byte detached signatures) that the backend
 * verifies in app/crypto.py.
 */
import nacl from "tweetnacl";
import * as Keychain from "react-native-keychain";

import { toBase64 } from "./encoding";

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

/**
 * Generates a fresh identity + prekey pair, stores the private halves in
 * the OS keystore, and returns the public halves ready to PUT to
 * /keys/me. Call this exactly once per device, the first time the app
 * runs after login - not on every launch.
 */
export async function generateAndStoreIdentity(): Promise<PublicKeyBundle> {
  const identityKeyPair = nacl.sign.keyPair();  // Ed25519
  const prekeyPair = nacl.box.keyPair();        // X25519

  // sign the prekey's public bytes with the identity secret key
  const signature = nacl.sign.detached(
    prekeyPair.publicKey,
    identityKeyPair.secretKey
  );

  const toStore: StoredPrivateKeys = {
    identitySecretKey: toBase64(identityKeyPair.secretKey),
    prekeySecretKey: toBase64(prekeyPair.secretKey),
  };

  await Keychain.setInternetCredentials(
    KEYCHAIN_SERVICE,
    "identity",
    JSON.stringify(toStore)
  );

  return {
    identityKeyPublic: toBase64(identityKeyPair.publicKey),
    signedPrekeyPublic: toBase64(prekeyPair.publicKey),
    prekeySignature: toBase64(signature),
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
