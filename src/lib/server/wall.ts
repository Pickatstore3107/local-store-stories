import { cacheLife, cacheTag } from "next/cache";
import { excerpt, type MemoryResult, type Wall, type WallMemory } from "@/lib/memories";
import type { Category, Visibility } from "@/lib/stories";
import {
  getPublicDocument,
  getPublicDocuments,
  hasDatabase,
  queryPublic,
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
const WALL_LIFE = { stale: 300, revalidate: 900, expire: 86400 };
const MEMORY_LIFE = { stale: 300, revalidate: 3600, expire: 86400 };
// After an error, try again a minute later.
const RETRY_LIFE = { stale: 300, revalidate: 60, expire: 3600 };

// Enough for the pilot. Beyond this the Wall needs a Firestore index, to
// fetch the newest first, and pages.
const WALL_LIMIT = 500;
const FEATURED_LIMIT = 6;
const CARD_CAPTION_MAX = 240;

const text = (value: unknown) => (typeof value === "string" && value ? value : null);
const number = (value: unknown) => (typeof value === "number" ? value : null);

function safely<T>(make: () => T) {
  try {
    return make();
  } catch {
    return null; // e.g. photos aren't switched on yet
  }
}

/** An approved story's public fields, or null for anything else. */
function readStory({ id, data }: PublicDocument) {
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

type PublicStory = NonNullable<ReturnType<typeof readStory>>;

/** Public profiles by user ID. The Wall still shows if they can't be read. */
async function loadAuthors(stories: PublicStory[]) {
  const uids = [...new Set(stories.map((s) => s.authorId))];
  try {
    const docs = await getPublicDocuments(uids.map((uid) => `users/${uid}`));
    return new Map(
      uids.map((uid) => {
        const profile = docs.get(`users/${uid}`)?.data;
        const name = text(profile?.displayName);
        return [uid, name ? { name, city: text(profile?.city) ?? "" } : null];
      }),
    );
  } catch (error) {
    console.error("Could not load the authors' names", error);
    return new Map<string, null>();
  }
}

/** Every approved memory shared with everyone, newest first. Null on error. */
export async function loadWall(): Promise<Wall | null> {
  "use cache";
  cacheTag(WALL_TAG);
  if (!hasDatabase()) {
    cacheLife(WALL_LIFE);
    return { memories: [], featured: [] };
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
    const authors = await loadAuthors(stories);
    const memories: WallMemory[] = stories
      .map((story) => ({
        id: story.id,
        storeName: story.storeName,
        category: story.category,
        city: story.city,
        neighbourhood: story.neighbourhood,
        caption: excerpt(story.caption, CARD_CAPTION_MAX),
        year: story.year,
        authorName: authors.get(story.authorId)?.name ?? null,
        photoUrl: safely(() => cardPhotoUrl(story.photoId)),
        approvedAt: story.approvedAt,
        featuredAt: story.featuredAt,
      }))
      .sort((a, b) => b.approvedAt - a.approvedAt);
    const featured = memories
      .filter((memory) => memory.featuredAt)
      .sort((a, b) => b.featuredAt! - a.featuredAt!)
      .slice(0, FEATURED_LIMIT);
    cacheLife(WALL_LIFE);
    return { memories, featured };
  } catch (error) {
    console.error("Could not load the Memory Wall", error);
    cacheLife(RETRY_LIFE);
    return null;
  }
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
    const name = text(profile?.data.displayName);
    return {
      status: "found",
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
        author: name ? { name, city: text(profile?.data.city) ?? "" } : null,
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
