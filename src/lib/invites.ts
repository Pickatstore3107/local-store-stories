import type { User } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { isInviteCode } from "./chain";
import { getFirebase } from "./firebase";
import type { Visibility } from "./stories";

// "Pass the memory": each memory comes with three personal invite links,
// /invite/{code}. Each works once, for someone who hasn't joined yet. When
// they join through it, their profile records who invited them, which is
// the Memory Chain's link. The security rules check every step.

export const INVITES_PER_MEMORY = 3;

/** invites/{code}. The random code is the link's secret. */
export type Invite = {
  from: string;
  storyId: string;
  /** The memory's. Only a memory shared with everyone is named on the chain. */
  visibility: Visibility;
  createdAt: Timestamp;
  /** Who joined through it. Only they and the sender can see this. */
  usedBy?: string;
  usedAt?: Timestamp;
};

export type MyInvite = {
  code: string;
  /** The name of the friend who joined through it, once someone has. */
  joined: { name: string | null } | null;
};

/** What a joining person needs to know about the invite they were sent. */
export type OpenInvite = { code: string; from: string; storyId: string; visibility: Visibility };

export type InviteCheck =
  | { status: "open"; invite: OpenInvite }
  | { status: "usedByMe" }
  /** Used by someone else, or the memory it was made for is gone. */
  | { status: "closed" };

// The same order everywhere, so "Invite 1" is always the same link.
const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function invites() {
  return collection(getFirebase().db, "invites");
}

function inviteSet(storyId: string) {
  return doc(getFirebase().db, "inviteSets", storyId);
}

async function nameOf(uid: string) {
  try {
    const profile = await getDoc(doc(getFirebase().db, "users", uid));
    const name = profile.get("displayName");
    return typeof name === "string" ? name : null;
  } catch {
    return null;
  }
}

/** The person's invites for one of their memories, if they have made them. */
export async function loadInvites(user: User, storyId: string): Promise<MyInvite[]> {
  const snapshot = await getDocs(
    query(invites(), where("from", "==", user.uid), where("storyId", "==", storyId)),
  );
  const list = snapshot.docs
    .map((d) => ({ code: d.id, ...(d.data() as Invite) }))
    .sort((a, b) => byCode(a.code, b.code));
  return Promise.all(
    list.map(async (invite) => ({
      code: invite.code,
      joined: invite.usedBy ? { name: await nameOf(invite.usedBy) } : null,
    })),
  );
}

/** Makes a memory's three invites, all at once. A memory only ever gets three. */
export async function makeInvites(
  user: User,
  storyId: string,
  visibility: Visibility,
): Promise<MyInvite[]> {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  const codes = Array.from({ length: INVITES_PER_MEMORY }, () => doc(invites()).id).sort(byCode);
  for (const code of codes) {
    batch.set(doc(db, "invites", code), {
      from: user.uid,
      storyId,
      visibility,
      createdAt: serverTimestamp(),
    });
  }
  batch.set(inviteSet(storyId), { from: user.uid, codes, createdAt: serverTimestamp() });
  await batch.commit();
  return codes.map((code) => ({ code, joined: null }));
}

/** Whether an invite can still be used, as the person opening it sees it. */
export async function checkInvite(code: string, user: User | null): Promise<InviteCheck> {
  if (!isInviteCode(code)) return { status: "closed" };
  try {
    const snapshot = await getDoc(doc(invites(), code));
    if (!snapshot.exists()) return { status: "closed" };
    const invite = snapshot.data() as Invite;
    if (invite.usedBy) return invite.usedBy === user?.uid ? { status: "usedByMe" } : { status: "closed" };
    return {
      status: "open",
      invite: { code, from: invite.from, storyId: invite.storyId, visibility: invite.visibility },
    };
  } catch (error) {
    // Once used, an invite is private to its sender and the person who used it.
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      return { status: "closed" };
    }
    throw error;
  }
}

/** The display name of the person who sent an invite. */
export function inviterName(invite: OpenInvite) {
  return nameOf(invite.from);
}

/**
 * Asks the server to rebuild these invites' pages, so a used or deleted
 * invite stops showing as open straight away. Otherwise it does within the hour.
 */
export async function refreshInvitePages(user: User, codes: string[]) {
  try {
    for (let i = 0; i < codes.length; i += 100) {
      const response = await fetch("/api/invites/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ codes: codes.slice(i, i + 100) }),
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
    }
  } catch (error) {
    console.error("Could not refresh the invite pages", error);
  }
}

/** Deletes some invites, and the memory's set when it's still there, together. */
async function deleteInvites(storyId: string, codes: string[], withSet: boolean) {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  for (const code of codes) batch.delete(doc(db, "invites", code));
  if (withSet) batch.delete(inviteSet(storyId));
  await batch.commit();
}

/** Takes back a memory's invites once the memory itself has been deleted. */
export async function deleteStoryInvites(user: User, storyId: string) {
  const snapshot = await getDocs(
    query(invites(), where("from", "==", user.uid), where("storyId", "==", storyId)),
  );
  if (snapshot.empty) return;
  // A memory's invites and its set are always made together.
  const codes = snapshot.docs.map((d) => d.id);
  await deleteInvites(storyId, codes, true);
  await refreshInvitePages(user, codes);
}

/** Takes back every invite, once the person's memories have been deleted. */
export async function deleteMyInvites(user: User) {
  const [sent, sets] = await Promise.all([
    getDocs(query(invites(), where("from", "==", user.uid))),
    getDocs(query(collection(getFirebase().db, "inviteSets"), where("from", "==", user.uid))),
  ]);
  const setIds = new Set(sets.docs.map((d) => d.id));
  const byStory = new Map<string, string[]>([...setIds].map((id) => [id, []]));
  for (const invite of sent.docs) {
    const { storyId } = invite.data() as Invite;
    byStory.set(storyId, [...(byStory.get(storyId) ?? []), invite.id]);
  }
  for (const [storyId, codes] of byStory) {
    await deleteInvites(storyId, codes, setIds.has(storyId));
  }
  if (!sent.empty) await refreshInvitePages(user, sent.docs.map((d) => d.id));
}

// The invite someone is joining through, kept while they sign in and
// agree to the welcome screen. It lives only in this browser tab.
const PENDING = "lss:invite";

export function pendingInvite() {
  try {
    return sessionStorage.getItem(PENDING);
  } catch {
    return null;
  }
}

export function setPendingInvite(code: string | null) {
  try {
    if (code) sessionStorage.setItem(PENDING, code);
    else sessionStorage.removeItem(PENDING);
  } catch {
    // Without storage they join on their own instead.
  }
}
