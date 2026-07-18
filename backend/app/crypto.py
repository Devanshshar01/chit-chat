"""
Server-side crypto touches PUBLIC KEYS ONLY. Private key generation and
storage happens on-device (client side, see client/crypto/identity.ts).

What the server *does* do: verify that a signed_prekey was actually signed
by the identity_key being claimed, before storing it. Without this check
anyone could upload an arbitrary prekey under someone else's identity.
"""
import base64

import nacl.signing
import nacl.exceptions


def verify_prekey_signature(
    identity_key_public_b64: str,
    signed_prekey_public_b64: str,
    signature_b64: str,
) -> bool:
    identity_pub = base64.b64decode(identity_key_public_b64)
    prekey_pub = base64.b64decode(signed_prekey_public_b64)
    signature = base64.b64decode(signature_b64)

    if len(identity_pub) != 32:
        return False

    verify_key = nacl.signing.VerifyKey(identity_pub)
    try:
        verify_key.verify(prekey_pub, signature)
        return True
    except nacl.exceptions.BadSignatureError:
        return False
    except Exception:
        return False
