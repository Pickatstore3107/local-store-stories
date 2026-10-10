import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import {
  collection,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import type { Profile } from "./account";
import { FriendlyError } from "./auth-errors";
import { getFirebase } from "./firebase";
import type { Report } from "./reports";
import { callApi, coverId, refreshWall, type Story, type StoryStatus } from "./stories";

export type ReviewAction = "approved" | "rejected" | "hidden";

// Where a moderator may move a story from each status.
// Must match reviewMoves() in firestore.rules.
export const REVIEW_MOVES: Record<StoryStatus, readonly ReviewAction[]> = {
  pending: ["approved", "rejected", "hidden"],
  approved: ["hidden"],
  rejected: ["approved"],
  hidden: ["approved"],
};

// Must match the limits in firestore.rules.
export const REVIEW_NOTE_MIN = 5;
export const REVIEW_NOTE_MAX = 300;

/** Ready-made notes for the author; the moderator can edit them before sending. */
export const NOTE_SUGGESTIONS = [
  ["Not about a store", "Please share a post about a local store or the people who ran it."],
  ["Unclear photo", "Please use a clear photo of the store, or of you there."],
  ["Personal details", "Please leave out phone numbers, addresses and other personal details."],
  ["Unkind", "Please keep your post kind about the real people in it."],
  ["Not their photo", "Please share only photos you took or have permission to use."],
] as const;

/** moderationLog/{logId}: one entry per decision. Only moderators can read it. */
export type LogEntry = {
  storyId: string;
  storeName: string;
  action: ReviewAction;
  from: StoryStatus;
  /** The moderator's user ID. Kept off the story so authors never see it. */
  by: string;
  at: Timestamp;
  note?: string;
};

export type ReviewStory = Story & {
  id: string;
  author: Pick<Profile, "displayName" | "city"> | null;
  /** The first photo, or the video's first frame. */
  photoUrl: string | null;
  /** Every photo, in order; empty for a video. */
  photoUrls: string[];
  videoUrl: string | null;
};

/** Taken off the site by reports, waiting for a moderator to put it back up or hide it. */
export const isHeld = (story: Pick<Story, "status" | "reportCount">) =>
  story.status === "pending" && (story.reportCount ?? 0) > 0;

/** Every photo of a story, or its video. */
function mediaIds(story: Story) {
  if (story.videoId) return [story.videoId];
  return story.photoIds ?? (story.photoId ? [story.photoId] : []);
}

// Enough for the pilot; the queue shows a note when there are more.
export const QUEUE_LIMIT = 100;
const LOG_LIMIT = 50;

/** Moderators are listed in moderators/{uid}, added by hand in the Firebase console. */
export async function isModerator(uid: string) {
  const { db } = getFirebase();
  return (await getDoc(doc(db, "moderators", uid))).exists();
}

export async function countWaiting() {
  const { db } = getFirebase();
  const pending = query(collection(db, "stories"), where("status", "==", "pending"));
  return (await getCountFromServer(pending)).data().count;
}

const openReports = () =>
  query(collection(getFirebase().db, "reports"), where("status", "==", "open"));

export async function countOpenReports() {
  return (await getCountFromServer(openReports())).data().count;
}

/** Public profiles, by user ID. Deleted profiles come back as null. */
async function loadProfiles(uids: string[]) {
  const { db } = getFirebase();
  const unique = [...new Set(uids)];
  const snapshots = await Promise.all(
    unique.map((uid) => getDoc(doc(db, "users", uid)).catch(() => null)),
  );
  return new Map(
    unique.map((uid, i) => {
      const snapshot = snapshots[i];
      return [uid, snapshot?.exists() ? (snapshot.data() as Profile) : null];
    }),
  );
}

type Links = { urls: Record<string, string>; videos: Record<string, string> };

/** Signed links to the private photos and videos, by ID. A video gets a still in urls. */
async function photoLinks(user: User, photoIds: string[]): Promise<Links> {
  if (!photoIds.length) return { urls: {}, videos: {} };
  try {
    const response = await callApi(user, "/api/photos/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds }),
    });
    const links = (await response.json()) as Partial<Links>;
    return { urls: links.urls ?? {}, videos: links.videos ?? {} };
  } catch (error) {
    console.error("Could not load photos", error); // the stories still show
    return { urls: {}, videos: {} };
  }
}

const millis = (time: Timestamp | undefined) => time?.toMillis() ?? 0;

/**
 * Stories with one status, each with its author's public name and a private
 * link to its photo. Waiting stories come oldest first, so nobody waits too
 * long; the others come most recently reviewed first.
 */
export async function loadReviewQueue(user: User, status: StoryStatus) {
  const { db } = getFirebase();
  const snapshot = await getDocs(
    query(collection(db, "stories"), where("status", "==", status), limit(QUEUE_LIMIT)),
  );
  const stories = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Story) }));
  if (status === "pending") stories.sort((a, b) => millis(a.createdAt) - millis(b.createdAt));
  else stories.sort((a, b) => millis(b.reviewedAt) - millis(a.reviewedAt));

  return { stories: await withDetails(user, stories), more: snapshot.size === QUEUE_LIMIT };
}

/** Adds each story's author and private links to its photos or video. */
async function withDetails(user: User, stories: (Story & { id: string })[]) {
  const [profiles, { urls, videos }] = await Promise.all([
    loadProfiles(stories.map((s) => s.authorId)),
    photoLinks(user, stories.flatMap(mediaIds)),
  ]);
  return stories.map((story): ReviewStory => {
    const cover = coverId(story);
    return {
      ...story,
      author: profiles.get(story.authorId) ?? null,
      photoUrl: cover ? (urls[cover] ?? null) : null,
      photoUrls: story.videoId ? [] : mediaIds(story).flatMap((id) => urls[id] ?? []),
      videoUrl: story.videoId ? (videos[story.videoId] ?? null) : null,
    };
  });
}

export type OpenReport = Report & { id: string };

/** The open reports about one memory. The story is null once its author deleted it. */
export type ReportGroup = { storyId: string; story: ReviewStory | null; reports: OpenReport[] };

/** Open reports, grouped by memory, the longest-waiting first. */
export async function loadReports(user: User) {
  const { db } = getFirebase();
  const snapshot = await getDocs(query(openReports(), limit(QUEUE_LIMIT)));
  const reports = snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as Report) }))
    .sort((a, b) => millis(a.at) - millis(b.at));
  const storyIds = [...new Set(reports.map((r) => r.storyId))];
  const snapshots = await Promise.all(storyIds.map((id) => getDoc(doc(db, "stories", id))));
  const stories = snapshots.flatMap((d) => (d.exists() ? [{ id: d.id, ...(d.data() as Story) }] : []));
  const detailed = new Map((await withDetails(user, stories)).map((story) => [story.id, story]));
  const groups: ReportGroup[] = storyIds.map((storyId) => ({
    storyId,
    story: detailed.get(storyId) ?? null,
    reports: reports.filter((r) => r.storyId === storyId),
  }));
  return { groups, more: snapshot.size === QUEUE_LIMIT };
}

function closing(user: User, outcome: NonNullable<Report["outcome"]>) {
  return { status: "closed", outcome, closedBy: user.uid, closedAt: serverTimestamp() } as const;
}

/** The open reports about one memory. */
async function openReportIds(storyId: string) {
  const snapshot = await getDocs(
    query(openReports(), where("storyId", "==", storyId), limit(QUEUE_LIMIT)),
  );
  return snapshot.docs.map((d) => d.id);
}

/**
 * Closes reports: the memory was hidden, a moderator looked and kept it up,
 * or its author has deleted it. Keeping it up starts its count of reports
 * again, so it takes three new ones to hold it back.
 */
export async function closeReports(
  user: User,
  reportIds: string[],
  outcome: NonNullable<Report["outcome"]>,
  storyId?: string,
) {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  for (const id of reportIds) batch.update(doc(db, "reports", id), closing(user, outcome));
  if (outcome === "kept" && storyId) {
    batch.update(doc(db, "stories", storyId), { reportCount: deleteField() });
  }
  try {
    await batch.commit();
  } catch (error) {
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new FriendlyError(
        "We couldn't close these reports. Someone may have just changed this post. Please refresh and try again.",
      );
    }
    throw error;
  }
}

/** Puts an approved memory in the Wall's Featured row, or takes it out. */
export async function featureStory(user: User, storyId: string, featured: boolean) {
  const { db } = getFirebase();
  try {
    await updateDoc(doc(db, "stories", storyId), {
      featuredAt: featured ? serverTimestamp() : deleteField(),
    });
  } catch (error) {
    const code = error instanceof FirebaseError ? error.code : null;
    if (code === "not-found") throw new FriendlyError("Its author has deleted this post.");
    if (code === "permission-denied") {
      throw new FriendlyError(
        "Only approved posts on Home can be featured. Please refresh and try again.",
      );
    }
    throw error;
  }
  await refreshWall(user, [storyId]);
}

/**
 * Approves, turns down or hides a story. The decision is written to the
 * moderation log in the same batch, and the security rules check both.
 * Approving or hiding a reported story closes its reports in the same
 * batch too, and approving starts its count of reports again.
 */
export async function reviewStory(
  user: User,
  story: Pick<ReviewStory, "id" | "storeName" | "status" | "reportCount">,
  action: ReviewAction,
  note = "",
  reportIds?: string[],
) {
  const { db } = getFirebase();
  const toClose =
    action === "rejected" ? [] : (reportIds ?? (story.reportCount ? await openReportIds(story.id) : []));
  const logRef = doc(collection(db, "moderationLog"));
  const text = note.trim();
  const batch = writeBatch(db);
  batch.update(doc(db, "stories", story.id), {
    status: action,
    reviewedAt: serverTimestamp(),
    reviewNote: action === "approved" ? deleteField() : text,
    reviewLogId: logRef.id,
    updatedAt: serverTimestamp(),
    ...(action === "approved" && { reportCount: deleteField() }),
  });
  batch.set(logRef, {
    storyId: story.id,
    storeName: story.storeName,
    action,
    from: story.status,
    by: user.uid,
    at: serverTimestamp(),
    ...(action !== "approved" && { note: text }),
  });
  for (const id of toClose) {
    batch.update(doc(db, "reports", id), closing(user, action === "hidden" ? "hidden" : "kept"));
  }
  try {
    await batch.commit();
  } catch (error) {
    const code = error instanceof FirebaseError ? error.code : null;
    if (code === "not-found") throw new FriendlyError("Its author has deleted this post.");
    if (code === "permission-denied") {
      throw new FriendlyError(
        "We couldn't save that. Someone may have just reviewed this post. Please refresh and try again.",
      );
    }
    throw error;
  }
  // Only approving or hiding changes what visitors see.
  if (action !== "rejected") await refreshWall(user, [story.id]);
}

/** The latest decisions, newest first, with each moderator's public name. */
export async function loadLog() {
  const { db } = getFirebase();
  const snapshot = await getDocs(
    query(collection(db, "moderationLog"), orderBy("at", "desc"), limit(LOG_LIMIT)),
  );
  const entries = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as LogEntry) }));
  const profiles = await loadProfiles(entries.map((e) => e.by));
  return entries.map((entry) => ({
    ...entry,
    moderatorName: profiles.get(entry.by)?.displayName ?? null,
  }));
}
