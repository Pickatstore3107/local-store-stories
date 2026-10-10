/**
 * The bold colour blocks behind posts: brand red, yellow and a pale yellow, with
 * the text colours that read on each. A post always gets the same block,
 * picked from its id, so its card on Home and its own page match.
 */
export type Block = {
  /** The block's colour. */
  bg: string;
  /** Titles and numbers on it. */
  text: string;
  /** Smaller words on it. */
  soft: string;
};

export const BLOCKS: Block[] = [
  { bg: "bg-brand-red", text: "text-white", soft: "text-white/80" },
  { bg: "bg-brand-yellow", text: "text-ink", soft: "text-ink/70" },
  { bg: "bg-butter", text: "text-brand-red", soft: "text-ink/70" },
];

export function blockOf(id: string): Block {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum = (sum * 31 + id.charCodeAt(i)) >>> 0;
  return BLOCKS[sum % BLOCKS.length];
}
