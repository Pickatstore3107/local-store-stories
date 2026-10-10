import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import { refreshWall } from "./stories";

// Must match reasons() in firestore.rules.
export const REPORT_REASONS = [
  ["unkind", "It's unkind or hurtful about someone"],
  ["private", "It shows private details, like a phone number or a child's face"],
  ["notStore", "It isn't about a local store"],
  ["rights", "It's my photo or my store, and I didn't agree to this"],
  ["other", "Something else"],
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number][0];

// Must match the limits in firestore.rules. "Something else" needs a few words.
export const REPORT_DETAILS_MIN = 5;
export const REPORT_DETAILS_MAX = 500;

// Posts go up at once. This many reports take one off the site until a
// moderator looks. Must match validReportCount() in firestore.rules.
export const REPORTS_TO_HOLD = 3;

/** reports/{storyId}_{uid}: one per person per memory. Only moderators read them. */
export type Report = {
  storyId: string;
  reason: ReportReason;
  details?: string;
  /** Who reported it. Only moderators and the reporter can see this. */
  by: string;
  at: Timestamp;
  status: "open" | "closed";
  /** Added to the post's reportCount when sent; reports from before that weren't. */
  counted?: true;
  outcome?: "hidden" | "kept" | "gone";
  closedBy?: string;
  closedAt?: Timestamp;
};

function reports() {
  return collection(getFirebase().db, "reports");
}

export async function hasReported(user: User, storyId: string) {
  const mine = await getDocs(
    query(reports(), where("by", "==", user.uid), where("storyId", "==", storyId)),
  );
  return !mine.empty;
}

/**
 * Sends a report and counts it on the post, in one write. Returns true when
 * it was the report that took the post off the site.
 */
export async function sendReport(user: User, storyId: string, reason: ReportReason, details: string) {
  const { db } = getFirebase();
  const text = details.trim();
  const storyRef = doc(db, "stories", storyId);
  const send = async () => {
    const count = ((await getDoc(storyRef)).data()?.reportCount as number | undefined) ?? 0;
    const hold = count + 1 >= REPORTS_TO_HOLD;
    const batch = writeBatch(db);
    batch.set(doc(reports(), `${storyId}_${user.uid}`), {
      storyId,
      reason,
      ...(text && { details: text }),
      by: user.uid,
      at: serverTimestamp(),
      status: "open",
      counted: true,
    });
    batch.update(storyRef, { reportCount: increment(1), ...(hold && { status: "pending" }) });
    await batch.commit();
    return hold;
  };
  let held: boolean;
  try {
    held = await send();
  } catch (error) {
    // Someone else may have reported it at the same moment, changing the count.
    if (!(error instanceof FirebaseError && error.code === "permission-denied")) throw error;
    held = await send();
  }
  if (held) await refreshWall(user, [storyId]);
  return held;
}

/**
 * Removes every report the person has sent, before their account is
 * deleted. An open report comes off its post's count in the same write.
 */
export async function deleteMyReports(user: User) {
  const { db } = getFirebase();
  const mine = await getDocs(query(reports(), where("by", "==", user.uid)));
  await Promise.all(
    mine.docs.map(async (report) => {
      const { storyId, status, counted } = report.data() as Report;
      if (status === "open" && counted) {
        const batch = writeBatch(db);
        batch.delete(report.ref);
        batch.update(doc(db, "stories", storyId), { reportCount: increment(-1) });
        try {
          return await batch.commit();
        } catch (error) {
          // The post is gone, so there's no count to change.
          if (!(error instanceof FirebaseError && error.code === "not-found")) throw error;
        }
      }
      await deleteDoc(report.ref);
    }),
  );
}
