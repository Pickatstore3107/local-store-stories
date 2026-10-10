import { cacheLife, cacheTag } from "next/cache";
import {
  isUserId,
  type FollowKind,
  type FollowListResult,
  type ListedPerson,
  type PersonResult,
} from "@/lib/people";
import { countPublic, getPublicDocument, getPublicDocuments, hasDatabase, queryPublic } from "./firestore";
import { RETRY_LIFE, WALL_LIFE, WALL_TAG, loadPublicMemories, readPerson, text, wallMemory } from "./wall";

// Profiles and who follows whom are read as an anonymous visitor sees them,
// like the Wall, and cached. Following someone, or changing your name,
// refreshes the pages involved (/api/people/refresh); otherwise they catch
// up within 15 minutes.

export const personTag = (uid: string) => `person-${uid}`;

// Enough for the pilot. Beyond this the lists need a Firestore index, to
// fetch the newest first, and pages.
const LIST_LIMIT = 1000;
const PROFILES_PER_READ = 100;

/** Someone's profile page: name, city, how many follow them and whom, and their memories. */
export async function loadPerson(uid: string): Promise<PersonResult> {
  "use cache";
  cacheTag(personTag(uid), WALL_TAG);
  if (!isUserId(uid) || !hasDatabase()) {
    cacheLife(WALL_LIFE);
    return { status: "missing" };
  }
  try {
    const profile = await getPublicDocument(`users/${uid}`);
    const { name, city } = profile ? readPerson(profile.data) : { name: null, city: null };
    if (!name) {
      cacheLife(WALL_LIFE);
      return { status: "missing" };
    }
    const [followers, following, wall] = await Promise.all([
      countPublic("follows", { to: uid }),
      countPublic("follows", { from: uid }),
      loadPublicMemories(),
    ]);
    const memories = (wall?.stories ?? [])
      .filter((story) => story.authorId === uid)
      .sort((a, b) => b.approvedAt - a.approvedAt)
      .map((story) => wallMemory(story, { ...wall?.people, [uid]: { name, city } }));
    // Without the Wall, the memories are missing: try again soon.
    cacheLife(wall ? WALL_LIFE : RETRY_LIFE);
    return { status: "found", person: { uid, name, city, followers, following, memories } };
  } catch (error) {
    console.error(`Could not load person ${uid}`, error);
    cacheLife(RETRY_LIFE);
    return { status: "error" };
  }
}

/** The names of these people, in the same order. Deleted accounts are left out. */
async function loadNames(uids: string[]): Promise<ListedPerson[]> {
  const found = new Map<string, ListedPerson>();
  for (let i = 0; i < uids.length; i += PROFILES_PER_READ) {
    const batch = uids.slice(i, i + PROFILES_PER_READ);
    const docs = await getPublicDocuments(batch.map((uid) => `users/${uid}`));
    for (const uid of batch) {
      const profile = docs.get(`users/${uid}`);
      const { name, city } = profile ? readPerson(profile.data) : { name: null, city: null };
      if (name) found.set(uid, { uid, name, city });
    }
  }
  return uids.flatMap((uid) => found.get(uid) ?? []);
}

/** Someone's followers, or the people they follow, the most recent first. */
export async function loadFollowList(uid: string, kind: FollowKind): Promise<FollowListResult> {
  "use cache";
  cacheTag(personTag(uid));
  if (!isUserId(uid) || !hasDatabase()) {
    cacheLife(WALL_LIFE);
    return { status: "missing" };
  }
  try {
    const [profile, follows] = await Promise.all([
      getPublicDocument(`users/${uid}`),
      queryPublic("follows", kind === "followers" ? { to: uid } : { from: uid }, LIST_LIMIT),
    ]);
    const { name, city } = profile ? readPerson(profile.data) : { name: null, city: null };
    if (!name) {
      cacheLife(WALL_LIFE);
      return { status: "missing" };
    }
    const others = follows
      .flatMap(({ data }) => {
        const other = text(kind === "followers" ? data.from : data.to);
        const at = typeof data.createdAt === "number" ? data.createdAt : 0;
        return other && isUserId(other) ? [{ uid: other, at }] : [];
      })
      .sort((a, b) => b.at - a.at)
      .map((follow) => follow.uid);
    const people = await loadNames([...new Set(others)]);
    cacheLife(WALL_LIFE);
    return { status: "found", owner: { uid, name, city }, people };
  } catch (error) {
    console.error(`Could not load the ${kind} of ${uid}`, error);
    cacheLife(RETRY_LIFE);
    return { status: "error" };
  }
}
