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
import { isInviteCode } from "./invite-links";
import { getFirebase } from "./firebase";
import type { Visibility } from "./stories";

// "Pass the memory": each memory comes with one invite link, /invite/{code},
// to send to friends, who can pass it on too. Anyone who hasn't joined yet
// can join through it. Their profile then records who invited them, they
// follow that friend, and a private record (joins/{uid}) says which link it
// was, for them and the friend who sent it. The security rules check every
// step.

/** invites/{code}. The random code is the link's secret. */
export type Invite = {
  from: string;
  storyId: string;
  /** The memory's. Only a memory shared with everyone is named on profiles. */
  visibility: Visibility;
  createdAt: Timestamp;
  /**
   * Invites from before shared links worked once, for one person. Once used,
   * only they and the sender can see it.
   */
  usedBy?: string;
  usedAt?: Timestamp;
};

/** joins/{uid}: the link someone joined through. Only they and its sender can see it. */
export type Join = { inviteCode: string; invitedBy: string; joinedAt: Timestamp };

export type MemoryInvite = {
  code: string;
  /** The names of the friends who joined through it, the first to join first. Null if unknown. */
  joined: (string | null)[] | null;
};

/** What a joining person needs to know about the invite they were sent. */
export type OpenInvite = { code: string; from: string; storyId: string; visibility: Visibility };

export type InviteCheck =
  | { status: "open"; invite: OpenInvite }
  /** They joined through it. `from` sent it. */
  | { status: "joinedHere"; from: string }
  /** The memory it was made for is gone (or, before shared links, someone else used it). */
  | { status: "closed" };

// The same order everywhere, so a memory from before shared links always
// shows the same one of its three links.
const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function invites() {
  return collection(getFirebase().db, "invites");
}

function inviteSet(storyId: string) {
  return doc(getFirebase().db, "inviteSets", storyId);
}

/** Someone's display name, or null if it can't be read (a deleted account). */
export async function nameOf(uid: string) {
  try {
    const profile = await getDoc(doc(getFirebase().db, "users", uid));
    const name = profile.get("displayName");
    return typeof name === "string" ? name : null;
  } catch {
    return null;
  }
}

const millis = (at: Timestamp | undefined) => at?.toMillis() ?? 0;

/** A memory's invite link and who joined through it, if the person has made it. */
export async function loadInvite(user: User, storyId: string): Promise<MemoryInvite | null> {
  const [sent, joins] = await Promise.all([
    getDocs(query(invites(), where("from", "==", user.uid), where("storyId", "==", storyId))),
    // The link matters more than who joined, so this never stops it showing.
    getDocs(query(collection(getFirebase().db, "joins"), where("invitedBy", "==", user.uid))).catch(
      (error) => {
        console.error("Could not load who joined", error);
        return null;
      },
    ),
  ]);
  if (sent.empty) return null;
  const list = sent.docs
    .map((d) => ({ code: d.id, ...(d.data() as Invite) }))
    .sort((a, b) => byCode(a.code, b.code));
  // Before shared links, each of the three worked once: show one still open.
  const code = (list.find((invite) => !invite.usedBy) ?? list[0]).code;
  if (!joins) return { code, joined: null };
  const codes = new Set(list.map((invite) => invite.code));
  const joined = [
    ...list.flatMap((invite) => (invite.usedBy ? [{ uid: invite.usedBy, at: invite.usedAt }] : [])),
    ...joins.docs
      .map((d) => ({ uid: d.id, ...(d.data() as Join) }))
      .filter((join) => codes.has(join.inviteCode))
      .map((join) => ({ uid: join.uid, at: join.joinedAt })),
  ].sort((a, b) => millis(a.at) - millis(b.at));
  return { code, joined: await Promise.all(joined.map((join) => nameOf(join.uid))) };
}

/** Makes a memory's invite link. A memory only ever gets one. */
export async function makeInvite(
  user: User,
  storyId: string,
  visibility: Visibility,
): Promise<MemoryInvite> {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  const code = doc(invites()).id;
  batch.set(doc(db, "invites", code), {
    from: user.uid,
    storyId,
    visibility,
    createdAt: serverTimestamp(),
  });
  batch.set(inviteSet(storyId), { from: user.uid, codes: [code], createdAt: serverTimestamp() });
  await batch.commit();
  return { code, joined: [] };
}

/** Whether someone can join through an invite, as the person opening it sees it. */
export async function checkInvite(code: string, user: User | null): Promise<InviteCheck> {
  if (!isInviteCode(code)) return { status: "closed" };
  try {
    const [snapshot, mine] = await Promise.all([
      getDoc(doc(invites(), code)),
      // Only read to welcome them back, so it never stops the check.
      user ? getDoc(doc(getFirebase().db, "joins", user.uid)).catch(() => null) : null,
    ]);
    if (!snapshot.exists()) return { status: "closed" };
    const invite = snapshot.data() as Invite;
    if (mine?.get("inviteCode") === code || (user && invite.usedBy === user.uid)) {
      return { status: "joinedHere", from: invite.from };
    }
    // Only its sender can still open a used invite from before shared links.
    if (invite.usedBy) return { status: "closed" };
    return {
      status: "open",
      invite: { code, from: invite.from, storyId: invite.storyId, visibility: invite.visibility },
    };
  } catch (error) {
    // A used invite from before shared links is private to the two people it connects.
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
 * Asks the server to rebuild these invites' pages, so a deleted invite stops
 * showing as open straight away. Otherwise it does within the hour.
 */
async function refreshInvitePages(user: User, codes: string[]) {
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

/** Takes back a memory's invite link once the memory itself has been deleted. */
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
