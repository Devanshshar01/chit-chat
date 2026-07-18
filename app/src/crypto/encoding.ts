/**
 * Pure-JS base64 + UTF-8 codecs, dependency-free and Hermes-safe.
 *
 * Hermes has no WebAssembly, no Buffer, and no atob/btoa, so these are
 * hand-rolled. Encoding always emits STANDARD base64 with padding -
 * that's what the backend's base64.b64decode expects. Decoding accepts
 * both standard and URL-safe alphabets, padded or not, so anything a
 * previous client version produced still parses.
 */

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const LOOKUP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  LOOKUP[ALPHABET[i]] = i;
}
// URL-safe variants map onto the same values
LOOKUP["-"] = 62;
LOOKUP["_"] = 63;

export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += ALPHABET[b0 >> 2];
    out += ALPHABET[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? ALPHABET[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? ALPHABET[b2 & 63] : "=";
  }
  return out;
}

export function fromBase64(b64: string): Uint8Array {
  const clean = b64.replace(/[=\s]+$/g, "");
  const outLen = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(outLen);
  let bits = 0;
  let bitCount = 0;
  let idx = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = LOOKUP[clean[i]];
    if (v === undefined) {
      throw new Error("invalid base64 character");
    }
    bits = (bits << 6) | v;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      out[idx++] = (bits >> bitCount) & 0xff;
    }
  }
  return out.subarray(0, idx);
}

export function utf8Encode(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

export function utf8Decode(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    let code: number;
    if (b0 < 0x80) {
      code = b0;
    } else if (b0 < 0xe0) {
      code = ((b0 & 0x1f) << 6) | (bytes[i++] & 0x3f);
    } else if (b0 < 0xf0) {
      code = ((b0 & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else {
      code =
        ((b0 & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
    }
    if (code > 0xffff) {
      code -= 0x10000;
      out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else {
      out += String.fromCharCode(code);
    }
  }
  return out;
}
