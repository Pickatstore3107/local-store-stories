import type { User } from "firebase/auth";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import type { ListedPerson } from "./people";
import { beforeLikes } from "./stories";

// Likes are public, as on Instagram: anyone can see who liked a memory.
// Liking writes likes/{storyId}_{uid} and, in the same batch, adds one to
// the memory's likeCount and makes the person its latest liker
// (lastLikerId), which the card shows by name. Memories loved before likes
// were public keep those loves private (src/lib/reactions.ts): they are in
// the count, but nobody ever sees who. The security rules check every step.

/** likes/{storyId}_{uid}. Anyone can see it. */
export type Like = { storyId: string; uid: string; at: Timestamp };

function likeRef(storyId: string, uid: string) {
  return doc(getFirebase().db, "likes", `${storyId}_${uid}`);
}

function oldLoveRef(storyId: string, uid: string) {
  return doc(getFirebase().db, "usersPrivate", uid, "reactions", storyId);
}

export async function like(user: User, storyId: string) {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.set(likeRef(storyId, user.uid), { storyId, uid: user.uid, at: serverTimestamp() });
  batch.update(doc(db, "stories", storyId), {
    likeCount: increment(1),
    lastLikerId: user.uid,
  });
  await batch.commit();
}

/**
 * Takes a like back, or a private love from before likes were public.
 * The memory's latest liker is cleared if it was them.
 */
export async function unlike(user: User, storyId: string) {
  const { db } = getFirebase();
  const storyRef = doc(db, "stories", storyId);
  const love = await getDoc(oldLoveRef(storyId, user.uid));
  if (love.exists()) {
    const batch = writeBatch(db);
    batch.delete(love.ref);
    batch.update(storyRef, { reactionCount: increment(-1) });
    await batch.commit();
    return;
  }
  await runTransaction(db, async (transaction) => {
    const story = await transaction.get(storyRef);
    const mine = likeRef(storyId, user.uid);
    if (!story.exists()) {
      transaction.delete(mine); // the memory is gone: nothing to count
      return;
    }
    transaction.delete(mine);
    transaction.update(storyRef, {
      likeCount: increment(-1),
      ...(story.data().lastLikerId === user.uid && { lastLikerId: deleteField() }),
    });
  });
}

/** The memories the signed-in person likes, or loved before likes were public. */
export type MyLikes = { ready: boolean; storyIds: ReadonlySet<string> };

// Enough for the pilot.
const MY_LIKES_LIMIT = 1000;

/** Calls back with the memories someone likes, now and whenever it changes. */
export function watchMyLikes(uid: string, onChange: (likes: MyLikes) => void) {
  const { db } = getFirebase();
  let liked: ReadonlySet<string> | null = null;
  let loved: ReadonlySet<string> | null = null;
  const send = () =>
    onChange({
      ready: liked !== null && loved !== null,
      storyIds: new Set([...(liked ?? []), ...(loved ?? [])]),
    });
  const failed = (what: string) => (error: unknown) => {
    // The rules stop the listener a moment before the page does on sign-out.
    if (getFirebase().auth.currentUser?.uid === uid) console.error(`Could not load ${what}`, error);
  };
  const stopLikes = onSnapshot(
    query(collection(db, "likes"), where("uid", "==", uid), limit(MY_LIKES_LIMIT)),
    (snapshot) => {
      liked = new Set(snapshot.docs.map((d) => (d.data() as Like).storyId));
      send();
    },
    (error) => {
      failed("your likes")(error);
      liked ??= new Set();
      send();
    },
  );
  const stopLoves = onSnapshot(
    collection(db, "usersPrivate", uid, "reactions"),
    (snapshot) => {
      loved = new Set(snapshot.docs.map((d) => d.id));
      send();
    },
    (error) => {
      failed("your loves")(error);
      loved ??= new Set();
      send();
    },
  );
  return () => {
    stopLikes();
    stopLoves();
  };
}

// Enough for the pilot. Beyond this the list needs a Firestore index, to
// fetch the newest first, and pages.
const LIKERS_LIMIT = 200;

/** Who liked a memory, the most recent first. Deleted accounts are left out. */
export async function loadLikers(storyId: string): Promise<ListedPerson[]> {
  const { db } = getFirebase();
  const likes = await getDocs(
    query(collection(db, "likes"), where("storyId", "==", storyId), limit(LIKERS_LIMIT)),
  );
  const newest = likes.docs
    .map((d) => d.data() as Like)
    .sort((a, b) => (b.at?.toMillis() ?? 0) - (a.at?.toMillis() ?? 0));
  const people = await Promise.all(
    newest.map(async ({ uid }) => {
      const profile = (await getDoc(doc(db, "users", uid))).data();
      const name = typeof profile?.displayName === "string" ? profile.displayName : null;
      const city = typeof profile?.city === "string" ? profile.city : null;
      return name ? { uid, name, city } : null;
    }),
  );
  return people.filter((person): person is ListedPerson => person !== null);
}

/** Takes back every like, for example before the account is deleted. */
export async function deleteMyLikes(user: User) {
  const { db } = getFirebase();
  const mine = await getDocs(query(collection(db, "likes"), where("uid", "==", user.uid))).then(
    (r) => r.docs,
    beforeLikes,
  );
  for (const d of mine) await unlike(user, (d.data() as Like).storyId);
}
