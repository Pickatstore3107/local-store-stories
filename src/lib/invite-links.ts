// What visitors see of invite links, shared by the server pages and the
// browser. Plain data and helpers only: no Firebase here.
import type { WallMemory } from "./memories";

/** What the page behind an invite link shows. */
export type InviteLanding =
  | {
      status: "open";
      inviter: { name: string; city: string | null } | null;
      /** The memory the invite was made for, once it's approved. */
      memory: WallMemory | null;
      shareImageUrl: string | null;
    }
  /** Used, taken back, or never existed. */
  | { status: "closed" };

// Firestore's automatic document IDs.
const CODE = /^[A-Za-z0-9]{20}$/;

export function isInviteCode(code: string) {
  return CODE.test(code);
}

export function invitePath(code: string) {
  return `/invite/${code}`;
}
