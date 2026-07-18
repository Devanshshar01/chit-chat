/**
 * A "sticker" here is just a big emoji rendered without a chat bubble -
 * zero image assets, zero licensing questions, and it works the instant
 * this bundles (no CDN, no download, nothing to go wrong at runtime).
 *
 * Swap this for real custom artwork later: keep the `id` values stable
 * (they're what's actually stored in sent messages), just change how
 * StickerBubble renders a given id.
 */
export interface Sticker {
  id: string;
  emoji: string;
  label: string;
}

export const STICKER_PACK: Sticker[] = [
  { id: "heart", emoji: "❤️", label: "heart" },
  { id: "fire", emoji: "🔥", label: "fire" },
  { id: "laughing", emoji: "😂", label: "laughing" },
  { id: "touched", emoji: "🥹", label: "touched" },
  { id: "sparkles", emoji: "✨", label: "sparkles" },
  { id: "hundred", emoji: "💯", label: "100" },
  { id: "eyes", emoji: "👀", label: "eyes" },
  { id: "skull", emoji: "💀", label: "dead (in a good way)" },
  { id: "clap", emoji: "👏", label: "clap" },
  { id: "party", emoji: "🎉", label: "party" },
  { id: "thinking", emoji: "🤔", label: "thinking" },
  { id: "wave", emoji: "👋", label: "wave" },
];

export function findSticker(id: string): Sticker | undefined {
  return STICKER_PACK.find((s) => s.id === id);
}
