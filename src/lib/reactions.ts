import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { getFirebase } from "./firebase";

// Loving a memory writes two things in one batch: a private record that this
// person loved it, at usersPrivate/{uid}/reactions/{storyId}, and one more on
// the memory's reactionCount. Nobody else can see who loved a memory; its
// author sees only how many people did. The security rules keep both in step.

function myReaction(user: User, storyId: string) {
  return doc(getFirebase().db, "usersPrivate", user.uid, "reactions", storyId);
}

export async function hasLoved(user: User, storyId: string) {
  return (await getDoc(myReaction(user, storyId))).exists();
}

/** Loves a memory, or takes the love back. */
export async function setLoved(user: User, storyId: string, loved: boolean) {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  if (loved) batch.set(myReaction(user, storyId), { at: serverTimestamp() });
  else batch.delete(myReaction(user, storyId));
  batch.update(doc(db, "stories", storyId), { reactionCount: increment(loved ? 1 : -1) });
  await batch.commit();
}

/** Takes back every love, for example before the account is deleted. */
export async function deleteMyReactions(user: User) {
  const { db } = getFirebase();
  const mine = await getDocs(collection(db, "usersPrivate", user.uid, "reactions"));
  for (const reaction of mine.docs) {
    try {
      await setLoved(user, reaction.id, false);
    } catch (error) {
      // Its author deleted the memory, so there is no count left to change.
      await deleteDoc(reaction.ref).catch(() => {
        throw error;
      });
    }
  }
}
