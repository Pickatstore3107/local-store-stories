import { cacheLife, cacheTag } from "next/cache";
import {
  isInviteCode,
  type Chain,
  type ChainPerson,
  type InviteLanding,
  type MemoryLinks,
} from "@/lib/chain";
import { excerpt } from "@/lib/memories";
import { getPublicDocument, hasDatabase } from "./firestore";
import { cardPhotoUrl, isStoryId, sharePhotoUrl, smallPhotoUrl } from "./photos";
import {
  MEMORY_LIFE,
  RETRY_LIFE,
  WALL_LIFE,
  WALL_TAG,
  loadPublicMemories,
  memoryTag,
  readPerson,
  readStory,
  safely,
  text,
  type PublicMemories,
  type PublicStory,
} from "./wall";

// The Memory Chain is drawn from the same public data as the Wall: approved
// memories shared with everyone, and their authors' profiles, each of which
// says who invited them. People appear by name only through a public memory.

export const inviteTag = (code: string) => `invite-${code}`;

const CARD_CAPTION_MAX = 240;

type Tree = { person: ChainPerson; memories: number; depth: number; firstAt: number; latestAt: number };

function buildChains({ stories, people }: PublicMemories): Chain[] {
  const memoriesOf = new Map<string, PublicStory[]>();
  for (const story of [...stories].sort((a, b) => b.approvedAt - a.approvedAt)) {
    memoriesOf.set(story.authorId, [...(memoriesOf.get(story.authorId) ?? []), story]);
  }

  // Who invited whom, among the people we can see.
  const parentOf = new Map<string, string>();
  for (const [uid, person] of Object.entries(people)) {
    if (person.invitedBy && person.invitedBy !== uid && people[person.invitedBy]) {
      parentOf.set(uid, person.invitedBy);
    }
  }
  // The app can't make a loop, but if one ever appeared, it's cut where it closes.
  for (const uid of [...parentOf.keys()]) {
    let at = parentOf.get(uid);
    for (let steps = 0; at !== undefined && steps <= parentOf.size; steps++) {
      if (at === uid) {
        parentOf.delete(uid);
        break;
      }
      at = parentOf.get(at);
    }
  }
  const childrenOf = new Map<string, string[]>();
  for (const [child, parent] of parentOf) {
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), child]);
  }

  function grow(uid: string, key: string): Tree {
    const own = memoriesOf.get(uid) ?? [];
    const person = people[uid];
    const children = (childrenOf.get(uid) ?? [])
      .map((child, i) => grow(child, `${key}.${i}`))
      .sort((a, b) => a.firstAt - b.firstAt);
    const times = [...own.map((s) => s.approvedAt), ...children.flatMap((c) => [c.firstAt, c.latestAt])];
    return {
      person: {
        key,
        name: own.length ? (person?.name ?? null) : null,
        uid: own.length && person?.name ? uid : null,
        city: own.length ? (person?.city ?? null) : null,
        memories: own.map((s) => ({ id: s.id, storeName: s.storeName })),
        photoUrl: own.length ? safely(() => smallPhotoUrl(own[0].photoId)) : null,
        children: children.map((c) => c.person),
      },
      memories: own.length + children.reduce((sum, c) => sum + c.memories, 0),
      depth: children.length ? 1 + Math.max(...children.map((c) => c.depth)) : 0,
      firstAt: times.length ? Math.min(...times) : 0,
      latestAt: times.length ? Math.max(...times) : 0,
    };
  }

  return Object.keys(people)
    .filter((uid) => !parentOf.has(uid) && childrenOf.has(uid))
    .map((uid, i) => {
      const tree = grow(uid, String(i));
      return {
        root: tree.person,
        inspired: tree.memories - tree.person.memories.length,
        depth: tree.depth,
        latestAt: tree.latestAt,
      };
    })
    .sort((a, b) => b.latestAt - a.latestAt);
}

/** Every chain someone has joined through an invite, the most recently grown first. */
export async function loadChains(): Promise<Chain[] | null> {
  "use cache";
  cacheTag(WALL_TAG);
  const data = await loadPublicMemories();
  if (!data) {
    cacheLife(RETRY_LIFE);
    return null;
  }
  const chains = buildChains(data);
  cacheLife(data.complete ? WALL_LIFE : RETRY_LIFE);
  return chains;
}

/**
 * Where a memory sits in the chain: who passed it on to its author, and the
 * public memories shared by people who joined through its invites.
 */
export async function loadMemoryLinks(
  storyId: string,
  invitedBy: { uid: string; storyId: string | null } | null,
): Promise<MemoryLinks> {
  "use cache";
  cacheTag(WALL_TAG);
  const data = await loadPublicMemories();
  if (!data) {
    cacheLife(RETRY_LIFE);
    return { from: null, inspired: [] };
  }
  let from: MemoryLinks["from"] = null;
  if (invitedBy) {
    const theirs = data.stories.filter((story) => story.authorId === invitedBy.uid);
    const via = theirs.find((story) => story.id === invitedBy.storyId);
    from = {
      name: theirs.length ? (data.people[invitedBy.uid]?.name ?? null) : null,
      memory: via ? { id: via.id, storeName: via.storeName } : null,
    };
  }
  const inspired = data.stories
    .filter((story) => data.people[story.authorId]?.invitedVia === storyId)
    .sort((a, b) => a.approvedAt - b.approvedAt)
    .map((story) => ({
      id: story.id,
      storeName: story.storeName,
      authorName: data.people[story.authorId]?.name ?? null,
      photoUrl: safely(() => smallPhotoUrl(story.photoId)),
    }));
  cacheLife(data.complete ? WALL_LIFE : RETRY_LIFE);
  return { from, inspired };
}

/**
 * What an invite link's page shows: who sent it and the memory it was made
 * for. Visitors can't read a used invite from before shared links, so it
 * reads as closed. Null on error.
 */
export async function loadInvite(code: string): Promise<InviteLanding | null> {
  "use cache";
  cacheTag(inviteTag(code));
  if (!isInviteCode(code) || !hasDatabase()) {
    cacheLife(MEMORY_LIFE);
    return { status: "closed" };
  }
  try {
    const invite = await getPublicDocument(`invites/${code}`);
    const from = text(invite?.data.from);
    const storyId = text(invite?.data.storyId);
    if (!invite || !from || !storyId) {
      cacheLife(MEMORY_LIFE);
      return { status: "closed" };
    }
    // Rebuilt with the memory's own page, when a moderator hides it.
    if (isStoryId(storyId)) cacheTag(memoryTag(storyId));
    const [profile, storyDoc] = await Promise.all([
      getPublicDocument(`users/${from}`).catch(() => null),
      isStoryId(storyId) ? getPublicDocument(`stories/${storyId}`).catch(() => null) : null,
    ]);
    const inviter = profile ? readPerson(profile.data) : null;
    // Readable only once a moderator has approved it.
    const story = storyDoc && readStory(storyDoc);
    cacheLife(MEMORY_LIFE);
    return {
      status: "open",
      inviter: inviter?.name ? { name: inviter.name, city: inviter.city } : null,
      memory: story
        ? {
            id: story.id,
            storeName: story.storeName,
            category: story.category,
            city: story.city,
            neighbourhood: story.neighbourhood,
            caption: excerpt(story.caption, CARD_CAPTION_MAX),
            year: story.year,
            authorId: story.authorId,
            authorName: inviter?.name ?? null,
            photoUrl: safely(() => cardPhotoUrl(story.photoId)),
            approvedAt: story.approvedAt,
            featuredAt: story.featuredAt,
          }
        : null,
      shareImageUrl: story ? safely(() => sharePhotoUrl(story.photoId)) : null,
    };
  } catch (error) {
    console.error(`Could not load invite ${code}`, error);
    cacheLife(RETRY_LIFE);
    return null;
  }
}
