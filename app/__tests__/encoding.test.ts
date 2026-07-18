import { toBase64, fromBase64, utf8Encode, utf8Decode } from '../src/crypto/encoding';

describe('base64', () => {
  it('round-trips bytes and matches standard base64', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const b64 = toBase64(bytes);
    expect(b64).toBe(Buffer.from(bytes).toString('base64'));
    expect(Array.from(fromBase64(b64))).toEqual(Array.from(bytes));
  });

  it('decodes URL-safe and unpadded input', () => {
    const bytes = new Uint8Array([251, 255, 190]);
    const urlSafe = Buffer.from(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(Array.from(fromBase64(urlSafe))).toEqual(Array.from(bytes));
  });

  it('throws on invalid characters', () => {
    expect(() => fromBase64('ab!c')).toThrow();
  });
});

describe('utf8', () => {
  it('round-trips ascii, multibyte, and emoji', () => {
    const text = 'hello — привет 中文 👍🏽';
    const bytes = utf8Encode(text);
    expect(Array.from(bytes)).toEqual(Array.from(Buffer.from(text, 'utf8')));
    expect(utf8Decode(bytes)).toBe(text);
  });
});
