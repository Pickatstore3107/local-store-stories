import { cacheLife, cacheTag } from "next/cache";
import type { Likes, MemoryResult, PublicComment, Wall, WallMemory } from "@/lib/memories";
import { isUserId } from "@/lib/people";
import { isPin, pinCenter } from "@/lib/pins";
import type { Category, Visibility } from "@/lib/stories";
import {
  getPublicDocument,
  getPublicDocuments,
  hasDatabase,
  queryPublic,
  queryPublicSince,
  type Fields,
  type PublicDocument,
} from "./firestore";
import {
  cardPhotoUrl,
  fullPhotoUrl,
  isStoryId,
  postPhotoUrl,
  sharePhotoUrl,
  videoUrl,
} from "./photos";

// The Wall and each memory's page are built from Firestore as an anonymous
// visitor sees it, then cached: visitors get a stored copy and Firestore is
// read only when the copy is refreshed. That keeps us inside the free plan.

export const WALL_TAG = "wall";
export const memoryTag = (id: string) => `memory-${id}`;

// Refreshed every 15 minutes, and straight away when a moderator approves,
// hides or features a memory, or an author deletes one (/api/wall/refresh).
// A memory's page is also refreshed when someone comments. Likes don't
// refresh anything, to keep within the free plan's reads: the person who
// liked sees it at once, and everyone else within 15 minutes.
export const WALL_LIFE = { stale: 300, revalidate: 900, expire: 86400 };
export const MEMORY_LIFE = { stale: 300, revalidate: 3600, expire: 86400 };
// After an error, try again a minute later.
export const RETRY_LIFE = { stale: 300, revalidate: 60, expire: 3600 };

// Enough for the pilot. Beyond this the Wall needs a Firestore index, to
// fetch the newest first, and pages.
const WALL_LIMIT = 500;
const FEATURED_LIMIT = 6;
const COMMENTS_LIMIT = 300;
// The likes of the last week, for what's trending on Home. Enough for the
// pilot; beyond it the busiest memories still come out on top.
const WEEK_MS = 7 * 86_400_000;
const WEEK_LIKES_LIMIT = 500;

export const text = (value: unknown) => (typeof value === "string" && value ? value : null);
const number = (value: unknown) => (typeof value === "number" ? value : null);

export function safely<T>(make: () => T) {
  try {
    return make();
  } catch {
    return null; // e.g. photos aren't switched on yet
  }
}

const MEDIA_LIMIT = 5;

/**
 * A story's photos in order and its video, if it has one. Older stories
 * have one photo, in photoId; newer ones up to five, in photoIds; a story
 * with a video has no photos.
 */
function readMedia(data: Fields) {
  const videoId = text(data.videoId);
  if (videoId) return { photoIds: [], videoId };
  const many = Array.isArray(data.photoIds) ? data.photoIds.map(text) : [];
  const photoIds = many.length ? many : [text(data.photoId)];
  return {
    photoIds: photoIds.filter((id): id is string => id !== null).slice(0, MEDIA_LIMIT),
    videoId: null,
  };
}

/** An approved story's public fields, or null for anything else. */
export function readStory({ id, data }: PublicDocument) {
  const { photoIds, videoId } = readMedia(data);
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
    photoIds,
    videoId,
    // Shown on cards, and when a link to it is shared: the video's first frame, or the first photo.
    coverId: videoId ?? photoIds[0] ?? null,
    sharedAt: number(data.createdAt) ?? 0,
    approvedAt: number(data.reviewedAt) ?? number(data.createdAt) ?? 0,
    featuredAt: number(data.featuredAt),
    pin: isPin(data.pin) ? pinCenter(data.pin) : null,
    likeCount: Math.max(0, number(data.likeCount) ?? 0),
    privateLoves: Math.max(0, number(data.reactionCount) ?? 0),
    lastLikerId: text(data.lastLikerId),
    commentCount: Math.max(0, number(data.commentCount) ?? 0),
  };
  const { authorId, storeName, category, city, caption, visibility, coverId } = story;
  if (
    data.status !== "approved" ||
    !(authorId && storeName && category && city && caption && visibility && coverId)
  ) {
    return null;
  }
  return { ...story, authorId, storeName, category, city, caption, visibility, coverId };
}

export type PublicStory = NonNullable<ReturnType<typeof readStory>>;

/** Someone's public profile: the name and city they chose. */
export type Person = { name: string | null; city: string | null };

export function readPerson(data: Fields): Person {
  return { name: text(data.displayName), city: text(data.city) };
}

export type PublicMemories = {
  /** Every approved memory shared with everyone. */
  stories: PublicStory[];
  /** Their authors, by user ID. */
  people: Record<string, Person>;
  /** False when the profiles couldn't be read; names are then missing. */
  complete: boolean;
};

const PROFILES_PER_READ = 100;

/** The public profiles of these people. Deleted accounts are left out. */
export async function loadPeople(uids: string[]) {
  const people: Record<string, Person> = {};
  const unique = [...new Set(uids)].filter(isUserId);
  for (let i = 0; i < unique.length; i += PROFILES_PER_READ) {
    const batch = unique.slice(i, i + PROFILES_PER_READ);
    const docs = await getPublicDocuments(batch.map((uid) => `users/${uid}`));
    for (const uid of batch) {
      const profile = docs.get(`users/${uid}`);
      if (profile) people[uid] = readPerson(profile.data);
    }
  }
  return people;
}

/**
 * The data behind the Wall and profiles: every approved public memory and
 * its author. Null on error.
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
      const people = await loadPeople(
        stories.flatMap((story) => (story.lastLikerId ? [story.authorId, story.lastLikerId] : [story.authorId])),
      );
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

/** Who liked a memory, as many as it says, with the latest liker's name if they still have an account. */
function likesOf(story: PublicStory, people: Record<string, Person>): Likes {
  const name = story.lastLikerId ? people[story.lastLikerId]?.name : null;
  return {
    count: story.likeCount + story.privateLoves,
    privateLoves: story.privateLoves,
    lastLiker: story.lastLikerId && name ? { uid: story.lastLikerId, name } : null,
  };
}

/** An approved memory as a post on Home, a square in Explore, or a card on the map or a profile. */
export function wallMemory(story: PublicStory, people: Record<string, Person>, weekLikes = 0): WallMemory {
  return {
    id: story.id,
    storeName: story.storeName,
    category: story.category,
    city: story.city,
    neighbourhood: story.neighbourhood,
    caption: story.caption,
    year: story.year,
    authorId: story.authorId,
    authorName: people[story.authorId]?.name ?? null,
    photoUrl: safely(() => cardPhotoUrl(story.coverId)),
    postPhotoUrl: safely(() => postPhotoUrl(story.coverId)),
    photoCount: story.photoIds.length,
    hasVideo: story.videoId !== null,
    sharedAt: story.sharedAt,
    approvedAt: story.approvedAt,
    featuredAt: story.featuredAt,
    pin: story.pin,
    likes: likesOf(story, people),
    weekLikes,
    comments: story.commentCount,
  };
}

/**
 * How many likes each memory got in the last seven days, by memory ID.
 * Empty on error: Home then ranks by all likes instead.
 */
async function loadWeekLikes(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (!hasDatabase()) return counts;
  try {
    const likes = await queryPublicSince("likes", "at", Date.now() - WEEK_MS, WEEK_LIKES_LIMIT);
    for (const { data } of likes) {
      const storyId = text(data.storyId);
      if (storyId) counts[storyId] = (counts[storyId] ?? 0) + 1;
    }
  } catch (error) {
    console.error("Could not load the likes of the last week", error);
  }
  return counts;
}

/** Every approved memory shared with everyone, newest first. Null on error. */
export async function loadWall(): Promise<Wall | null> {
  "use cache";
  cacheTag(WALL_TAG);
  const [data, weekLikes] = await Promise.all([loadPublicMemories(), loadWeekLikes()]);
  if (!data) {
    cacheLife(RETRY_LIFE);
    return null;
  }
  const memories = data.stories
    .map((story) => wallMemory(story, data.people, weekLikes[story.id] ?? 0))
    .sort((a, b) => b.approvedAt - a.approvedAt);
  const featured = memories
    .filter((memory) => memory.featuredAt)
    .sort((a, b) => b.featuredAt! - a.featuredAt!)
    .slice(0, FEATURED_LIMIT);
  cacheLife(data.complete ? WALL_LIFE : RETRY_LIFE);
  return { memories, featured, builtAt: Date.now() };
}

/** A memory's comments, the oldest first, with their authors' names. */
async function loadComments(storyId: string): Promise<PublicComment[]> {
  const docs = await queryPublic("comments", { storyId }, COMMENTS_LIMIT);
  const comments = docs.flatMap(({ id, data }) => {
    const authorId = text(data.authorId);
    const body = text(data.text);
    const createdAt = number(data.createdAt);
    return authorId && body && createdAt !== null ? [{ id, authorId, text: body, createdAt }] : [];
  });
  const people = await loadPeople(comments.map((comment) => comment.authorId));
  return comments
    .map((comment) => ({ ...comment, authorName: people[comment.authorId]?.name ?? null }))
    .sort((a, b) => a.createdAt - b.createdAt);
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

    const [people, comments] = await Promise.all([
      loadPeople(story.lastLikerId ? [story.authorId, story.lastLikerId] : [story.authorId]).catch(
        () => ({}) as Record<string, Person>,
      ),
      loadComments(id).catch((error) => {
        console.error(`Could not load the comments of memory ${id}`, error);
        return null;
      }),
    ]);
    const author = people[story.authorId];
    const name = author?.name;
    // Without the comments, try again soon.
    if (comments === null) cacheLife(RETRY_LIFE);
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
        author: name ? { uid: story.authorId, name, city: author?.city ?? "" } : null,
        sharedAt: story.sharedAt,
        approvedAt: story.approvedAt,
        featuredAt: story.featuredAt,
        pin: story.pin,
        photoUrl: safely(() => fullPhotoUrl(story.coverId)),
        postPhotoUrl: safely(() => postPhotoUrl(story.coverId)),
        photoCount: story.photoIds.length,
        hasVideo: story.videoId !== null,
        photoUrls: story.photoIds.flatMap((photoId) => safely(() => fullPhotoUrl(photoId)) ?? []),
        videoUrl: story.videoId ? safely(() => videoUrl(story.videoId!)) : null,
        shareImageUrl: safely(() => sharePhotoUrl(story.coverId)),
        likes: likesOf(story, people),
        comments: comments ?? [],
        builtAt: Date.now(),
      },
    };
  } catch (error) {
    console.error(`Could not load memory ${id}`, error);
    cacheLife(RETRY_LIFE);
    return { status: "error" };
  }
}
