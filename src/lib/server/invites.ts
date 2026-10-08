import { cacheLife, cacheTag } from "next/cache";
import { isInviteCode, type InviteLanding } from "@/lib/invite-links";
import { excerpt } from "@/lib/memories";
import { getPublicDocument, hasDatabase } from "./firestore";
import { cardPhotoUrl, isStoryId, sharePhotoUrl } from "./photos";
import { MEMORY_LIFE, RETRY_LIFE, memoryTag, readPerson, readStory, safely, text } from "./wall";

export const inviteTag = (code: string) => `invite-${code}`;

const CARD_CAPTION_MAX = 240;

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
