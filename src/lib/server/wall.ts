import { cacheLife, cacheTag } from "next/cache";
import { excerpt, type MemoryResult, type Wall, type WallMemory } from "@/lib/memories";
import type { Category, Visibility } from "@/lib/stories";
import {
  getPublicDocument,
  getPublicDocuments,
  hasDatabase,
  queryPublic,
  type Fields,
  type PublicDocument,
} from "./firestore";
import { cardPhotoUrl, fullPhotoUrl, isStoryId, sharePhotoUrl } from "./photos";

// The Wall and each memory's page are built from Firestore as an anonymous
// visitor sees it, then cached: visitors get a stored copy and Firestore is
// read only when the copy is refreshed. That keeps us inside the free plan.

export const WALL_TAG = "wall";
export const memoryTag = (id: string) => `memory-${id}`;

// Refreshed every 15 minutes, and straight away when a moderator approves,
// hides or features a memory, or an author deletes one (/api/wall/refresh).
export const WALL_LIFE = { stale: 300, revalidate: 900, expire: 86400 };
export const MEMORY_LIFE = { stale: 300, revalidate: 3600, expire: 86400 };
// After an error, try again a minute later.
export const RETRY_LIFE = { stale: 300, revalidate: 60, expire: 3600 };

// Enough for the pilot. Beyond this the Wall needs a Firestore index, to
// fetch the newest first, and pages.
const WALL_LIMIT = 500;
const FEATURED_LIMIT = 6;
const CARD_CAPTION_MAX = 240;

export const text = (value: unknown) => (typeof value === "string" && value ? value : null);
const number = (value: unknown) => (typeof value === "number" ? value : null);

export function safely<T>(make: () => T) {
  try {
    return make();
  } catch {
    return null; // e.g. photos aren't switched on yet
  }
}

/** An approved story's public fields, or null for anything else. */
export function readStory({ id, data }: PublicDocument) {
  const story = {
    id,
    authorId: text(data.authorId),
    storeName: text(data.storeName),
    category: text(data.category) as Category | null,
    city: text(data.city),
    neighbourhood: text(data.neighbourhood),
    caption: text(data.caption),
    year: number(data.year),
    ordered: text(data.ordered),
    visibility: text(data.visibility) as Visibility | null,
    photoId: text(data.photoId),
    sharedAt: number(data.createdAt) ?? 0,
    approvedAt: number(data.reviewedAt) ?? number(data.createdAt) ?? 0,
    featuredAt: number(data.featuredAt),
  };
  const { authorId, storeName, category, city, caption, visibility, photoId } = story;
  if (
    data.status !== "approved" ||
    !(authorId && storeName && category && city && caption && visibility && photoId)
  ) {
    return null;
  }
  return { ...story, authorId, storeName, category, city, caption, visibility, photoId };
}

export type PublicStory = NonNullable<ReturnType<typeof readStory>>;

/** Someone's public profile, with who invited them (the Memory Chain's link). */
export type Person = {
  name: string | null;
  city: string | null;
  invitedBy: string | null;
  /** The memory they were invited through. */
  invitedVia: string | null;
};

export function readPerson(data: Fields): Person {
  return {
    name: text(data.displayName),
    city: text(data.city),
    invitedBy: text(data.invitedBy),
    invitedVia: text(data.invitedVia),
  };
}

export type PublicMemories = {
  /** Every approved memory shared with everyone. */
  stories: PublicStory[];
  /** Their authors, and everyone up their invite chains, by user ID. */
  people: Record<string, Person>;
  /** False when the profiles couldn't be read; names are then missing. */
  complete: boolean;
};

const USER_ID = /^[A-Za-z0-9]{1,128}$/;
// How far up an invite chain to look, and how many profiles to read at once.
const CHAIN_ROUNDS = 25;
const PROFILES_PER_READ = 100;

/**
 * The public profiles of these people and of everyone who invited them, up
 * each chain. Deleted accounts are left out, which ends their chain there.
 */
async function loadPeople(uids: string[]) {
  const people: Record<string, Person> = {};
  const asked = new Set<string>();
  let next = [...new Set(uids)];
  for (let round = 0; next.length && round < CHAIN_ROUNDS; round++) {
    for (const uid of next) asked.add(uid);
    for (let i = 0; i < next.length; i += PROFILES_PER_READ) {
      const batch = next.slice(i, i + PROFILES_PER_READ);
      const docs = await getPublicDocuments(batch.map((uid) => `users/${uid}`));
      for (const uid of batch) {
        const profile = docs.get(`users/${uid}`);
        if (profile) people[uid] = readPerson(profile.data);
      }
    }
    const inviters = next.flatMap((uid) => people[uid]?.invitedBy ?? []);
    next = [...new Set(inviters)].filter((uid) => USER_ID.test(uid) && !asked.has(uid));
  }
  return people;
}

/**
 * The data behind the Wall and the Memory Chain: every approved public
 * memory and the people around them. Null on error.
 */
export async function loadPublicMemories(): Promise<PublicMemories | null> {
  "use cache";
  cacheTag(WALL_TAG);
  if (!hasDatabase()) {
    cacheLife(WALL_LIFE);
    return { stories: [], people: {}, complete: true };
  }
  try {
    const docs = await queryPublic(
      "stories",
      { status: "approved", visibility: "public" },
      WALL_LIMIT,
    );
    const stories = docs.flatMap((doc) => {
      const story = readStory(doc);
      return story?.visibility === "public" ? [story] : [];
    });
    try {
      const people = await loadPeople(stories.map((story) => story.authorId));
      cacheLife(WALL_LIFE);
      return { stories, people, complete: true };
    } catch (error) {
      // The Wall still shows, without names, and tries again soon.
      console.error("Could not load the authors' profiles", error);
      cacheLife(RETRY_LIFE);
      return { stories, people: {}, complete: false };
    }
  } catch (error) {
    console.error("Could not load the public memories", error);
    cacheLife(RETRY_LIFE);
    return null;
  }
}

/** Every approved memory shared with everyone, newest first. Null on error. */
export async function loadWall(): Promise<Wall | null> {
  "use cache";
  cacheTag(WALL_TAG);
  const data = await loadPublicMemories();
  if (!data) {
    cacheLife(RETRY_LIFE);
    return null;
  }
  const memories: WallMemory[] = data.stories
    .map((story) => ({
      id: story.id,
      storeName: story.storeName,
      category: story.category,
      city: story.city,
      neighbourhood: story.neighbourhood,
      caption: excerpt(story.caption, CARD_CAPTION_MAX),
      year: story.year,
      authorName: data.people[story.authorId]?.name ?? null,
      photoUrl: safely(() => cardPhotoUrl(story.photoId)),
      approvedAt: story.approvedAt,
      featuredAt: story.featuredAt,
    }))
    .sort((a, b) => b.approvedAt - a.approvedAt);
  const featured = memories
    .filter((memory) => memory.featuredAt)
    .sort((a, b) => b.featuredAt! - a.featuredAt!)
    .slice(0, FEATURED_LIMIT);
  cacheLife(data.complete ? WALL_LIFE : RETRY_LIFE);
  return { memories, featured };
}

/** One approved memory, whether it's on the Wall or shared by link. */
export async function loadMemory(id: string): Promise<MemoryResult> {
  "use cache";
  cacheTag(memoryTag(id));
  if (!isStoryId(id) || !hasDatabase()) {
    cacheLife(MEMORY_LIFE);
    return { status: "missing" };
  }
  try {
    const doc = await getPublicDocument(`stories/${id}`);
    const story = doc && readStory(doc);
    cacheLife(MEMORY_LIFE);
    if (!story) return { status: "missing" };

    const profile = await getPublicDocument(`users/${story.authorId}`).catch(() => null);
    const author = profile ? readPerson(profile.data) : null;
    const name = author?.name;
    return {
      status: "found",
      invitedBy: author?.invitedBy ? { uid: author.invitedBy, storyId: author.invitedVia } : null,
      memory: {
        id: story.id,
        storeName: story.storeName,
        category: story.category,
        city: story.city,
        neighbourhood: story.neighbourhood,
        caption: story.caption,
        year: story.year,
        ordered: story.ordered,
        visibility: story.visibility,
        author: name ? { name, city: author?.city ?? "" } : null,
        sharedAt: story.sharedAt,
        approvedAt: story.approvedAt,
        featuredAt: story.featuredAt,
        photoUrl: safely(() => fullPhotoUrl(story.photoId)),
        shareImageUrl: safely(() => sharePhotoUrl(story.photoId)),
      },
    };
  } catch (error) {
    console.error(`Could not load memory ${id}`, error);
    cacheLife(RETRY_LIFE);
    return { status: "error" };
  }
}
