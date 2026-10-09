import type { User } from "firebase/auth";
import { collection, deleteDoc, doc, getDocs, increment, writeBatch } from "firebase/firestore";
import { getFirebase } from "./firebase";

// Before likes were public (src/lib/likes.ts), people loved memories
// privately: a record at usersPrivate/{uid}/reactions/{storyId} that only
// they can see, and one more on the memory's reactionCount. Those loves stay
// private and still count. No new ones are made; the like button takes one
// back (unlike in src/lib/likes.ts), and so does deleting the account.

/** Takes back every private love, before the account is deleted. */
export async function deleteMyReactions(user: User) {
  const { db } = getFirebase();
  const mine = await getDocs(collection(db, "usersPrivate", user.uid, "reactions"));
  for (const reaction of mine.docs) {
    const batch = writeBatch(db);
    batch.delete(reaction.ref);
    batch.update(doc(db, "stories", reaction.id), { reactionCount: increment(-1) });
    try {
      await batch.commit();
    } catch (error) {
      // Its author deleted the memory, so there is no count left to change.
      await deleteDoc(reaction.ref).catch(() => {
        throw error;
      });
    }
  }
}
