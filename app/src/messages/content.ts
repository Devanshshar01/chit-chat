/**
 * The server treats message content as an opaque blob (by design - see
 * the README's encryption caveat). Everything about "what kind of
 * message is this" lives in a JSON payload the CLIENT defines, encodes,
 * and decodes. The wire format is unchanged: base64(JSON.stringify(this)).
 *
 * When real encryption lands, this JSON is what gets encrypted - nothing
 * about this schema needs to change, just what wraps it before sending.
 */
import { toBase64, fromBase64, utf8Encode, utf8Decode } from "../crypto/encoding";

export type MessageContent =
  | { type: "text"; text: string }
  | { type: "sticker"; stickerId: string }
  | { type: "gif"; url: string; previewUrl: string; width: number; height: number }
  | {
      type: "link";
      url: string;
      text: string; // what the user actually typed, including the URL
      title: string | null;
      description: string | null;
      imageUrl: string | null;
    };

export async function encodeContent(content: MessageContent): Promise<string> {
  return toBase64(utf8Encode(JSON.stringify(content)));
}

export async function decodeContent(base64: string): Promise<MessageContent> {
  try {
    const json = utf8Decode(fromBase64(base64));
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && "type" in parsed) {
      return parsed as MessageContent;
    }
  } catch {
    // fall through to the legacy-text fallback below
  }
  // Messages sent before this schema existed (step 5's chat screen) are
  // just base64(plaintext) with no envelope - treat anything undecodable
  // as plain legacy text instead of crashing the render.
  try {
    return { type: "text", text: utf8Decode(fromBase64(base64)) };
  } catch {
    return { type: "text", text: "[unreadable message]" };
  }
}

/** Simple URL detector for "did the user paste a link" - not exhaustive, good enough for chat. */
const URL_REGEX = /https?:\/\/[^\s]+/i;

export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}
