import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import { nameOf, type Join } from "./invites";
import { callApi } from "./stories";

// Following, as on Instagram: anyone can see who follows whom. Each follow
// is follows/{follower}_{followed}, so nobody follows the same person twice.
// Following someone also rings their bell (bells/{uid}), the dot on the bell
// at the top of the page, in the same batch. Blocks are private to the
// person who blocked, and end any follow between the two. The security
// rules check every step.

/** follows/{from}_{to}. Anyone can see it. */
export type Follow = { from: string; to: string; createdAt: Timestamp };

/** blocks/{from}_{to}. Only `from` can see it. */
export type Block = { from: string; to: string; createdAt: Timestamp };

/** bells/{uid}. Only its owner can read it. */
type Bell = { ringAt?: Timestamp; seenAt?: Timestamp };

const pair = (from: string, to: string) => `${from}_${to}`;

function followRef(from: string, to: string) {
  return doc(getFirebase().db, "follows", pair(from, to));
}

function blockRef(from: string, to: string) {
  return doc(getFirebase().db, "blocks", pair(from, to));
}

function bellRef(uid: string) {
  return doc(getFirebase().db, "bells", uid);
}

/**
 * Asks the server to rebuild these people's profiles and follower lists, so
 * a change shows straight away. Otherwise it shows within 15 minutes.
 */
export async function refreshPeople(user: User, uids: string[]) {
  try {
    for (let i = 0; i < uids.length; i += 100) {
      await callApi(user, "/api/people/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uids: uids.slice(i, i + 100) }),
        // Finishes even if they leave the page straight after.
        keepalive: true,
      });
    }
  } catch (error) {
    console.error("Could not refresh the profiles", error); // they catch up on their own
  }
}

export async function follow(user: User, uid: string) {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.set(followRef(user.uid, uid), { from: user.uid, to: uid, createdAt: serverTimestamp() });
  batch.set(bellRef(uid), { ringAt: serverTimestamp() }, { merge: true });
  await batch.commit();
  await refreshPeople(user, [user.uid, uid]);
}

export async function unfollow(user: User, uid: string) {
  await deleteDoc(followRef(user.uid, uid));
  await refreshPeople(user, [user.uid, uid]);
}

/** Stops someone following you. They aren't told, and can follow you again. */
export async function removeFollower(user: User, uid: string) {
  await deleteDoc(followRef(uid, user.uid));
  await refreshPeople(user, [user.uid, uid]);
}

/** Blocks someone: neither follows the other any more, and they can't follow you. */
export async function block(user: User, uid: string) {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.set(blockRef(user.uid, uid), { from: user.uid, to: uid, createdAt: serverTimestamp() });
  batch.delete(followRef(uid, user.uid));
  batch.delete(followRef(user.uid, uid));
  await batch.commit();
  await refreshPeople(user, [user.uid, uid]);
}

export async function unblock(user: User, uid: string) {
  await deleteDoc(blockRef(user.uid, uid));
}

/** Who the signed-in person follows and has blocked, by user ID. */
export type MyFollows = {
  /** False until both lists have loaded. */
  ready: boolean;
  following: ReadonlySet<string>;
  blocked: ReadonlySet<string>;
};

/**
 * Logs a listener's error, unless the person has just signed out: then the
 * rules stop the listener a moment before the page does.
 */
function logUnlessSignedOut(uid: string, what: string) {
  return (error: unknown) => {
    if (getFirebase().auth.currentUser?.uid === uid) console.error(`Could not load ${what}`, error);
  };
}

/** Calls back with who someone follows and has blocked, now and whenever it changes. */
export function watchMyFollows(uid: string, onChange: (follows: MyFollows) => void) {
  const { db } = getFirebase();
  let following: ReadonlySet<string> | null = null;
  let blocked: ReadonlySet<string> | null = null;
  const send = () =>
    onChange({
      ready: following !== null && blocked !== null,
      following: following ?? new Set(),
      blocked: blocked ?? new Set(),
    });
  const stopFollowing = onSnapshot(
    query(collection(db, "follows"), where("from", "==", uid)),
    (snapshot) => {
      following = new Set(snapshot.docs.map((d) => (d.data() as Follow).to));
      send();
    },
    (error) => {
      logUnlessSignedOut(uid, "who you follow")(error);
      following ??= new Set();
      send();
    },
  );
  const stopBlocked = onSnapshot(
    query(collection(db, "blocks"), where("from", "==", uid)),
    (snapshot) => {
      blocked = new Set(snapshot.docs.map((d) => (d.data() as Block).to));
      send();
    },
    (error) => {
      logUnlessSignedOut(uid, "who you blocked")(error);
      blocked ??= new Set();
      send();
    },
  );
  return () => {
    stopFollowing();
    stopBlocked();
  };
}

const millis = (at: Timestamp | null | undefined) => at?.toMillis() ?? 0;

/** Calls back with when someone last followed this person and when they last looked. */
export function watchBell(uid: string, onChange: (bell: { ringAt: number; seenAt: number }) => void) {
  return onSnapshot(
    bellRef(uid),
    (snapshot) => {
      const bell = (snapshot.data({ serverTimestamps: "estimate" }) ?? {}) as Bell;
      onChange({ ringAt: millis(bell.ringAt), seenAt: millis(bell.seenAt) });
    },
    logUnlessSignedOut(uid, "the bell"),
  );
}

/** When they last looked at their activity. */
async function lastSeen(user: User) {
  const bell = (await getDoc(bellRef(user.uid))).data() as Bell | undefined;
  return millis(bell?.seenAt);
}

/** They've looked at their activity, so the bell's dot goes. */
export async function markBellSeen(user: User) {
  await setDoc(bellRef(user.uid), { seenAt: serverTimestamp() }, { merge: true });
}

/** Someone who followed you, or joined through one of your invite links. */
export type Activity = {
  uid: string;
  name: string | null;
  /** When it happened, in milliseconds. */
  at: number;
  /** They joined through one of your invite links. */
  joined: boolean;
  followsYou: boolean;
};

// Enough for the pilot. Beyond this the list needs a Firestore index, to
// fetch the newest first.
const ACTIVITY_READ = 500;
const ACTIVITY_SHOWN = 50;

/**
 * The newest followers and friends who joined through your links, newest
 * first, and when you last looked.
 */
export async function loadActivity(user: User): Promise<{ items: Activity[]; seenAt: number }> {
  const { db } = getFirebase();
  const [followers, joins, seenAt] = await Promise.all([
    getDocs(query(collection(db, "follows"), where("to", "==", user.uid), limit(ACTIVITY_READ))),
    getDocs(
      query(collection(db, "joins"), where("invitedBy", "==", user.uid), limit(ACTIVITY_READ)),
    ),
    lastSeen(user),
  ]);
  const byPerson = new Map<string, Activity>();
  for (const d of joins.docs) {
    const { joinedAt } = d.data() as Join;
    byPerson.set(d.id, { uid: d.id, name: null, at: millis(joinedAt), joined: true, followsYou: false });
  }
  for (const d of followers.docs) {
    const { from, createdAt } = d.data() as Follow;
    const joined = byPerson.get(from);
    // Joining through a link follows its sender too: one line for both.
    if (joined) {
      joined.followsYou = true;
      joined.at = Math.max(joined.at, millis(createdAt));
    } else {
      byPerson.set(from, { uid: from, name: null, at: millis(createdAt), joined: false, followsYou: true });
    }
  }
  const newest = [...byPerson.values()].sort((a, b) => b.at - a.at).slice(0, ACTIVITY_SHOWN);
  const items = await Promise.all(
    newest.map(async (item) => ({ ...item, name: await nameOf(item.uid) })),
  );
  return { items, seenAt };
}

/** How many people follow this person. Firestore counts them without sending them. */
export async function countFollowers(uid: string) {
  const { db } = getFirebase();
  const counted = await getCountFromServer(query(collection(db, "follows"), where("to", "==", uid)));
  return counted.data().count;
}

/**
 * Ends every follow to and from the person and takes back their blocks,
 * before their account is deleted.
 */
export async function deleteMyFollows(user: User) {
  const { db } = getFirebase();
  const [mine, theirs, blocks] = await Promise.all([
    getDocs(query(collection(db, "follows"), where("from", "==", user.uid))),
    getDocs(query(collection(db, "follows"), where("to", "==", user.uid))),
    getDocs(query(collection(db, "blocks"), where("from", "==", user.uid))),
  ]);
  const refs = [...mine.docs, ...theirs.docs, ...blocks.docs].map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(i, i + 400)) batch.delete(ref);
    await batch.commit();
  }
  const people = [
    ...mine.docs.map((d) => (d.data() as Follow).to),
    ...theirs.docs.map((d) => (d.data() as Follow).from),
  ];
  if (people.length) await refreshPeople(user, [...new Set([user.uid, ...people])]);
}
