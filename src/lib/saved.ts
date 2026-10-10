import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import { beforeLikes } from "./stories";

// Saved places, like a bookmark: usersPrivate/{uid}/saved/{storyId}, with
// when it was saved. Only the person who saved a memory can see that they
// did; nobody else, not even its author, is told. The rules check it.

/** usersPrivate/{uid}/saved/{storyId}. */
export type Saved = { at: number };

function savedRef(uid: string, storyId: string) {
  return doc(getFirebase().db, "usersPrivate", uid, "saved", storyId);
}

export async function save(user: User, storyId: string) {
  await setDoc(savedRef(user.uid, storyId), { at: serverTimestamp() });
}

export async function unsave(user: User, storyId: string) {
  await deleteDoc(savedRef(user.uid, storyId));
}

/** The memories someone saved, the newest first. */
export type MySaved = { ready: boolean; storyIds: readonly string[] };

// Enough for the pilot.
const MY_SAVED_LIMIT = 500;

/** Calls back with the memories someone saved, now and whenever it changes. */
export function watchMySaved(uid: string, onChange: (saved: MySaved) => void) {
  const { db } = getFirebase();
  return onSnapshot(
    query(collection(db, "usersPrivate", uid, "saved"), limit(MY_SAVED_LIMIT)),
    (snapshot) => {
      // A save still on its way has no time yet; it's the newest.
      const at = (d: (typeof snapshot.docs)[number]) =>
        d.data({ serverTimestamps: "estimate" }).at?.toMillis?.() ?? Date.now();
      const newest = [...snapshot.docs].sort((a, b) => at(b) - at(a));
      onChange({ ready: true, storyIds: newest.map((d) => d.id) });
    },
    (error) => {
      // The rules stop the listener a moment before the page does on sign-out.
      if (getFirebase().auth.currentUser?.uid === uid) console.error("Could not load your saved places", error);
      onChange({ ready: true, storyIds: [] });
    },
  );
}

/** Forgets every saved place, before the account is deleted. */
export async function deleteMySaved(user: User) {
  const { db } = getFirebase();
  const mine = await getDocs(collection(db, "usersPrivate", user.uid, "saved")).then(
    (r) => r.docs,
    beforeLikes,
  );
  for (const d of mine) await deleteDoc(d.ref);
}
