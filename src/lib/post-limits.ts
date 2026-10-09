// Keeps bots and scripts from flooding the moderators with memories: each
// person can share one memory a minute and a few a day. The count lives at
// postLimits/{uid}, written in the same batch as each new memory, and the
// security rules check it. Must match postLimits in firestore.rules.

/** The shortest wait between two memories from the same person. */
export const MEMORY_GAP_MS = 60 * 1000;

/** How many memories one person can share in a day. */
export const DAILY_MEMORY_LIMIT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A person's postLimits document, with times in milliseconds. */
export type PostLimit = { lastAt: number; windowStart: number; count: number };

/**
 * Whether the person may share a memory now and, if so, whether this one
 * starts a new day's count. A missing record means they haven't shared one
 * yet. `now` is this device's clock, so the rules have the final word.
 */
export function checkPostLimit(
  before: PostLimit | null,
  now: number,
): { ok: true; newWindow: boolean; count: number } | { ok: false; message: string } {
  if (!before) return { ok: true, newWindow: true, count: 1 };
  if (now < before.lastAt + MEMORY_GAP_MS) {
    return {
      ok: false,
      message: "You shared a memory a moment ago. Please wait a minute before sharing the next one.",
    };
  }
  if (now >= before.windowStart + DAY_MS) return { ok: true, newWindow: true, count: 1 };
  if (before.count >= DAILY_MEMORY_LIMIT) {
    return {
      ok: false,
      message: `You've shared ${DAILY_MEMORY_LIMIT} memories in the last day, the most for one day. Please share the next one a little later.`,
    };
  }
  return { ok: true, newWindow: false, count: before.count + 1 };
}

/** Reads a postLimits document's fields, or null when they aren't all there. */
export function readPostLimit(data: Record<string, unknown> | undefined | null): PostLimit | null {
  if (!data) return null;
  const { lastAt, windowStart, count } = data;
  if (typeof lastAt !== "number" || typeof windowStart !== "number" || typeof count !== "number") {
    return null;
  }
  return { lastAt, windowStart, count };
}
