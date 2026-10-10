import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import { fold, searchWords } from "./memories";
import { photoOf, searchName, type ListedPerson } from "./people";

// Members can find each other by name. Each profile keeps its name in small
// letters without accents (nameLower), and a search asks for names that
// start with what was typed, 20 at a time, which is all the security rules
// allow. The rules can't check nameLower, so each result's real name is
// checked here too.

const SEARCH_LIMIT = 20;

/** Whether a name has every word someone typed, each at the start of a word. */
export function nameMatches(name: string, words: string[]) {
  const parts = fold(name).split(/\s+/);
  return words.every((word) => parts.some((part) => part.startsWith(word)));
}

/** Members whose name starts with what was typed. Signed-in members only. */
export async function searchPeople(typed: string): Promise<ListedPerson[]> {
  const start = searchName(typed);
  if (!start) return [];
  const { db } = getFirebase();
  const found = await getDocs(
    query(
      collection(db, "users"),
      where("nameLower", ">=", start),
      where("nameLower", "<", `${start}\uf8ff`),
      orderBy("nameLower"),
      limit(SEARCH_LIMIT),
    ),
  );
  const words = searchWords(typed);
  return found.docs.flatMap((d) => {
    const data = d.data();
    const { displayName, city } = data;
    if (typeof displayName !== "string" || !nameMatches(displayName, words)) return [];
    const photo = photoOf(data)?.small ?? null;
    return [{ uid: d.id, name: displayName, city: typeof city === "string" ? city : null, photo }];
  });
}

/**
 * Adds the searchable name to a profile made before people could be found
 * by name, or brings it up to date. Quietly gives up on any error.
 */
export async function keepSearchable(user: User, profile: { displayName: string; nameLower?: string }) {
  const nameLower = searchName(profile.displayName);
  if (!nameLower || profile.nameLower === nameLower) return;
  try {
    await updateDoc(doc(getFirebase().db, "users", user.uid), {
      nameLower,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Could not make the profile searchable", error);
  }
}
