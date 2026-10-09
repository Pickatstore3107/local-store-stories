import { cacheLife, cacheTag } from "next/cache";
import { isInviteCode, type InviteLanding } from "@/lib/invite-links";
import { getPublicDocument, hasDatabase } from "./firestore";
import { isStoryId, sharePhotoUrl } from "./photos";
import { MEMORY_LIFE, RETRY_LIFE, memoryTag, readPerson, readStory, safely, text, wallMemory } from "./wall";

export const inviteTag = (code: string) => `invite-${code}`;

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
      memory: story ? wallMemory(story, inviter ? { [story.authorId]: inviter } : {}) : null,
      shareImageUrl: story ? safely(() => sharePhotoUrl(story.photoId)) : null,
    };
  } catch (error) {
    console.error(`Could not load invite ${code}`, error);
    cacheLife(RETRY_LIFE);
    return null;
  }
}
