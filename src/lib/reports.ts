import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { getFirebase } from "./firebase";

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

/** reports/{storyId}_{uid}: one per person per memory. Only moderators read them. */
export type Report = {
  storyId: string;
  reason: ReportReason;
  details?: string;
  /** Who reported it. Only moderators and the reporter can see this. */
  by: string;
  at: Timestamp;
  status: "open" | "closed";
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

export async function sendReport(user: User, storyId: string, reason: ReportReason, details: string) {
  const text = details.trim();
  await setDoc(doc(reports(), `${storyId}_${user.uid}`), {
    storyId,
    reason,
    ...(text && { details: text }),
    by: user.uid,
    at: serverTimestamp(),
    status: "open",
  });
}

/** Removes every report the person has sent, before their account is deleted. */
export async function deleteMyReports(user: User) {
  const mine = await getDocs(query(reports(), where("by", "==", user.uid)));
  await Promise.all(mine.docs.map((report) => deleteDoc(report.ref)));
}
