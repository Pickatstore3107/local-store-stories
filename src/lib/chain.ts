// What visitors see of the Memory Chain and of invite links, shared by the
// server pages and the browser. Plain data and helpers only: no Firebase here.
import type { WallMemory } from "./memories";

/** A memory as the chain shows it: a name to read and a page to open. */
export type ChainMemory = { id: string; storeName: string };

/** Someone on the Memory Chain, with the people who joined through their invites. */
export type ChainPerson = {
  /** Stable within one chain, for lists. */
  key: string;
  /** Null for people without a public memory yet: they show as "a friend". */
  name: string | null;
  /** For their profile's address. Null when they show as "a friend". */
  uid: string | null;
  city: string | null;
  /** Their public memories, newest first. */
  memories: ChainMemory[];
  /** A small photo from their newest memory. */
  photoUrl: string | null;
  children: ChainPerson[];
};

/** Everyone who joined, one invite after another, from one first person. */
export type Chain = {
  root: ChainPerson;
  /** Public memories shared by everyone after the first person. */
  inspired: number;
  /** The longest run of friends the memory was passed through. */
  depth: number;
  /** When its newest memory was approved, in milliseconds. */
  latestAt: number;
};

/** How one memory sits in the chain, for its own page. */
export type MemoryLinks = {
  /** Who passed the memory on to its author, when they joined through an invite. */
  from: { name: string | null; memory: ChainMemory | null } | null;
  /** Public memories by people who joined through this memory's invites. */
  inspired: (ChainMemory & { authorName: string | null; photoUrl: string | null })[];
};

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

/** "3 friends deep" */
export function depthLine(depth: number) {
  return depth === 1 ? "1 friend deep" : `${depth} friends deep`;
}

/** "5 memories inspired" */
export function inspiredLine(count: number) {
  return count === 1 ? "1 memory inspired" : `${count} memories inspired`;
}
