import type { User } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { FriendlyError } from "./auth-errors";
import { getFirebase } from "./firebase";
import { beforeLikes, callApi } from "./stories";

// Comments under a memory show at once, to anyone who can see the memory.
// Each one moves the memory's commentCount in the same batch, naming the
// comment in commentChange so the count only moves with a real one. To keep
// bots out, each person can comment once every 10 seconds and 100 times a
// day (commentLimits/{uid}, in the same batch), and comments can't have
// links. Their author, the memory's author and moderators can delete them,
// and anyone signed in can report one. The security rules check every step.

// Must match the limits in firestore.rules.
export const COMMENT_MAX = 500;
export const COMMENT_GAP_MS = 10 * 1000;
export const DAILY_COMMENT_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/** comments/{commentId}. Anyone who can see the memory can read it. */
export type CommentDoc = { storyId: string; authorId: string; text: string; createdAt: Timestamp };

/** Links are the usual sign of spam, so comments can't have them. Must match noLinks() in firestore.rules. */
export function hasLink(text: string) {
  return /https?:\/\/|www\./i.test(text);
}

type Limit = { lastAt: number; windowStart: number; count: number };

function readLimit(data: DocumentData | undefined): Limit | null {
  const millis = (value: unknown) => (value as Timestamp | undefined)?.toMillis?.();
  const lastAt = millis(data?.lastAt);
  const windowStart = millis(data?.windowStart);
  const count = data?.count;
  if (lastAt === undefined || windowStart === undefined || typeof count !== "number") return null;
  return { lastAt, windowStart, count };
}

/** Whether a comment is allowed now and, if so, whether it starts a new day's count. */
function checkLimit(before: Limit | null, now: number) {
  if (!before) return { ok: true as const, newWindow: true };
  if (now < before.lastAt + COMMENT_GAP_MS) {
    return { ok: false as const, message: "You commented a moment ago. Please wait a few seconds." };
  }
  if (now >= before.windowStart + DAY_MS) return { ok: true as const, newWindow: true };
  if (before.count >= DAILY_COMMENT_LIMIT) {
    return {
      ok: false as const,
      message: `You've written ${DAILY_COMMENT_LIMIT} comments in the last day, the most for one day. Please try again later.`,
    };
  }
  return { ok: true as const, newWindow: false };
}

/** Adds a comment to an approved memory, and returns its ID. */
export async function addComment(user: User, storyId: string, text: string) {
  const clean = text.trim();
  if (!clean) throw new FriendlyError("Please write a comment first.");
  if (clean.length > COMMENT_MAX) {
    throw new FriendlyError(`Please keep your comment under ${COMMENT_MAX} characters.`);
  }
  if (hasLink(clean)) throw new FriendlyError("Comments can't have links in them.");

  const { db } = getFirebase();
  const limitRef = doc(db, "commentLimits", user.uid);
  const raw = (await getDoc(limitRef)).data();
  const check = checkLimit(readLimit(raw), Date.now());
  if (!check.ok) throw new FriendlyError(check.message);

  const commentRef = doc(collection(db, "comments"));
  const save = (newWindow: boolean) => {
    const batch = writeBatch(db);
    batch.set(commentRef, { storyId, authorId: user.uid, text: clean, createdAt: serverTimestamp() });
    batch.update(doc(db, "stories", storyId), {
      commentCount: increment(1),
      commentChange: commentRef.id,
    });
    batch.set(limitRef, {
      lastAt: serverTimestamp(),
      windowStart: newWindow || !raw ? serverTimestamp() : raw.windowStart,
      count: newWindow || !raw ? 1 : raw.count + 1,
    });
    return batch.commit();
  };
  try {
    await save(check.newWindow);
  } catch (error) {
    // This device's clock may disagree with the database's about when the
    // day's count started again, so the other answer is tried once.
    const denied = error instanceof FirebaseError && error.code === "permission-denied";
    if (!denied || !raw) throw error;
    try {
      await save(!check.newWindow);
    } catch {
      throw error;
    }
  }
  return commentRef.id;
}

/** Deletes a comment: the person's own, one on their memory, or any, for a moderator. */
export async function deleteComment(user: User, comment: { id: string; storyId: string }) {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.delete(doc(db, "comments", comment.id));
  batch.update(doc(db, "stories", comment.storyId), {
    commentCount: increment(-1),
    commentChange: comment.id,
  });
  try {
    await batch.commit();
  } catch (error) {
    // The memory may be gone, with no count left to change. The rules allow
    // this only then.
    await deleteDoc(doc(db, "comments", comment.id)).catch(() => {
      throw error;
    });
  }
}

/**
 * Asks the server to rebuild the memory's page, so a new or deleted
 * comment shows for everyone straight away. Home catches up within 15 minutes.
 */
export async function refreshComments(user: User, storyId: string) {
  try {
    await callApi(user, "/api/wall/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyIds: [storyId], wall: false }),
      keepalive: true,
    });
  } catch (error) {
    console.error("Could not refresh the memory's page", error); // it catches up on its own
  }
}

// Must match reasons() in commentReports in firestore.rules.
export const COMMENT_REPORT_REASONS = [
  ["unkind", "It's unkind or hurtful"],
  ["private", "It shares private details, like a phone number"],
  ["spam", "It's spam or an advert"],
  ["other", "Something else"],
] as const;

export type CommentReportReason = (typeof COMMENT_REPORT_REASONS)[number][0];

/** commentReports/{commentId}_{uid}: one per person per comment. Only moderators read them. */
export type CommentReport = {
  commentId: string;
  storyId: string;
  reason: CommentReportReason;
  details?: string;
  by: string;
  at: Timestamp;
  status: "open" | "closed";
  outcome?: "gone" | "kept";
  closedBy?: string;
  closedAt?: Timestamp;
};

export async function reportComment(
  user: User,
  comment: { id: string; storyId: string },
  reason: CommentReportReason,
  details: string,
) {
  const text = details.trim();
  await setDoc(doc(getFirebase().db, "commentReports", `${comment.id}_${user.uid}`), {
    commentId: comment.id,
    storyId: comment.storyId,
    reason,
    ...(text && { details: text }),
    by: user.uid,
    at: serverTimestamp(),
    status: "open",
  });
}

/** Deletes every comment the person wrote, before their account is deleted. */
export async function deleteMyComments(user: User) {
  const { db } = getFirebase();
  const mine = await getDocs(query(collection(db, "comments"), where("authorId", "==", user.uid))).then(
    (r) => r.docs,
    beforeLikes,
  );
  const storyIds = new Set<string>();
  for (const d of mine) {
    const { storyId } = d.data() as CommentDoc;
    await deleteComment(user, { id: d.id, storyId });
    storyIds.add(storyId);
  }
  for (const storyId of storyIds) await refreshComments(user, storyId);
}

/** Removes every comment report the person has sent, before their account is deleted. */
export async function deleteMyCommentReports(user: User) {
  const { db } = getFirebase();
  const mine = await getDocs(
    query(collection(db, "commentReports"), where("by", "==", user.uid), limit(1000)),
  ).then((r) => r.docs, beforeLikes);
  await Promise.all(mine.map((report) => deleteDoc(report.ref)));
}

// Moderators deal with reported comments on /moderate, one comment at a time.

/** A reported comment with its open reports. `comment` is null once it's deleted. */
export type CommentReportGroup = {
  commentId: string;
  storyId: string;
  comment: { text: string; authorId: string; authorName: string | null } | null;
  storeName: string | null;
  reports: (CommentReport & { id: string })[];
};

// Enough for the pilot; the page shows a note when there are more.
export const COMMENT_REPORTS_LIMIT = 100;

function openCommentReports() {
  return query(collection(getFirebase().db, "commentReports"), where("status", "==", "open"));
}

export async function countOpenCommentReports() {
  return (await getCountFromServer(openCommentReports())).data().count;
}

/** The reported comments, each with its reports, the longest waiting first. */
export async function loadCommentReports() {
  const { db } = getFirebase();
  const snapshot = await getDocs(query(openCommentReports(), limit(COMMENT_REPORTS_LIMIT)));
  const reports = snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as CommentReport) }))
    .sort((a, b) => (a.at?.toMillis() ?? 0) - (b.at?.toMillis() ?? 0));
  const commentIds = [...new Set(reports.map((r) => r.commentId))];
  const groups = await Promise.all(
    commentIds.map(async (commentId): Promise<CommentReportGroup> => {
      const mine = reports.filter((r) => r.commentId === commentId);
      const storyId = mine[0].storyId;
      const [comment, story] = await Promise.all([
        getDoc(doc(db, "comments", commentId)),
        getDoc(doc(db, "stories", storyId)).catch(() => null),
      ]);
      const data = comment.exists() ? (comment.data() as CommentDoc) : null;
      const author = data ? await getDoc(doc(db, "users", data.authorId)).catch(() => null) : null;
      const authorName = author?.data()?.displayName;
      return {
        commentId,
        storyId,
        comment: data
          ? { text: data.text, authorId: data.authorId, authorName: typeof authorName === "string" ? authorName : null }
          : null,
        storeName: story?.exists() ? (story.data().storeName as string) : null,
        reports: mine,
      };
    }),
  );
  return { groups, more: snapshot.size === COMMENT_REPORTS_LIMIT };
}

function closing(user: User, outcome: "gone" | "kept") {
  return { status: "closed", outcome, closedBy: user.uid, closedAt: serverTimestamp() };
}

/**
 * Deletes a reported comment and closes its reports, in one write, or
 * keeps the comment up and closes them. A comment its author already
 * deleted just has its reports closed.
 */
export async function closeCommentReports(user: User, group: CommentReportGroup, outcome: "gone" | "kept") {
  const { db } = getFirebase();
  const write = (withCount: boolean) => {
    const batch = writeBatch(db);
    if (outcome === "gone" && group.comment) {
      batch.delete(doc(db, "comments", group.commentId));
      if (withCount) {
        batch.update(doc(db, "stories", group.storyId), {
          commentCount: increment(-1),
          commentChange: group.commentId,
        });
      }
    }
    for (const report of group.reports) {
      batch.update(doc(db, "commentReports", report.id), closing(user, outcome));
    }
    return batch.commit();
  };
  if (outcome === "gone" && group.comment && group.storeName !== null) {
    try {
      await write(true);
    } catch (error) {
      // The memory may have been deleted meanwhile, with no count to change.
      await write(false).catch(() => {
        throw error;
      });
    }
  } else {
    await write(false);
  }
  if (outcome === "gone" && group.comment) await refreshComments(user, group.storyId);
}
