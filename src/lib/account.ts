import { deleteUser, type User } from "firebase/auth";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { deleteMyCommentReports, deleteMyComments } from "./comments";
import { CONSENT_VERSION } from "./consent";
import { getFirebase } from "./firebase";
import { deleteMyFollows, refreshPeople } from "./follows";
import { deleteMyInvites, type OpenInvite } from "./invites";
import { deleteMyLikes } from "./likes";
import { deleteMyReactions } from "./reactions";
import { deleteMyReports } from "./reports";
import { deleteAllMyStories } from "./stories";

/** Public profile, readable by anyone: users/{uid}. */
export type Profile = {
  displayName: string;
  /**
   * The name in small letters without accents, for searching. Kept in step
   * with the name on each visit (keepSearchable in src/lib/people-search.ts),
   * so joining and renaming work the same with older security rules.
   */
  nameLower?: string;
  city: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Set once, when someone joins through a friend's invite: who invited them. */
  invitedBy?: string;
  /** The memory the invite was made for, if it's shared with everyone. */
  invitedVia?: string;
};

/** Private consent record, readable only by its owner: usersPrivate/{uid}. */
export type ConsentRecord = {
  consentVersion: string;
  consentAt: Timestamp;
  ageConfirmed: true;
};

export const NAME_MAX = 40;
export const CITY_MIN = 2;
export const CITY_MAX = 60;

export async function loadAccount(uid: string) {
  const { db } = getFirebase();
  const [profile, consent] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDoc(doc(db, "usersPrivate", uid)),
  ]);
  return {
    profile: profile.exists() ? (profile.data() as Profile) : null,
    consent: consent.exists() ? (consent.data() as ConsentRecord) : null,
  };
}

/**
 * Records consent and creates the public profile in one atomic write,
 * so a profile can never exist without consent (enforced in the rules).
 * Joining through a friend's invite link also records the link, privately,
 * and follows the friend, in the same write.
 */
export async function createAccount(
  uid: string,
  input: { displayName: string; city: string },
  invite: OpenInvite | null = null,
) {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.set(doc(db, "usersPrivate", uid), {
    consentVersion: CONSENT_VERSION,
    consentAt: serverTimestamp(),
    ageConfirmed: true,
  });
  batch.set(doc(db, "users", uid), {
    displayName: input.displayName.trim(),
    city: input.city.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(invite && {
      invitedBy: invite.from,
      // A memory shared only by link isn't named: its address is the link's secret.
      ...(invite.visibility === "public" && { invitedVia: invite.storyId }),
    }),
  });
  if (invite) {
    // Not on the public profile: anyone could read the link there.
    batch.set(doc(db, "joins", uid), {
      inviteCode: invite.code,
      invitedBy: invite.from,
      joinedAt: serverTimestamp(),
    });
    // They follow the friend who sent it, which rings that friend's bell.
    batch.set(doc(db, "follows", `${uid}_${invite.from}`), {
      from: uid,
      to: invite.from,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, "bells", invite.from), { ringAt: serverTimestamp() }, { merge: true });
  }
  await batch.commit();
}

export async function updateProfile(
  uid: string,
  input: { displayName: string; city: string },
) {
  const { db } = getFirebase();
  await updateDoc(doc(db, "users", uid), {
    displayName: input.displayName.trim(),
    city: input.city.trim(),
    updatedAt: serverTimestamp(),
  });
}

/** Firebase only allows deleting an account within 5 minutes of signing in. */
export function signedInRecently(user: User) {
  const last = Date.parse(user.metadata.lastSignInTime ?? "");
  return Number.isFinite(last) && Date.now() - last < 4 * 60 * 1000;
}

/**
 * Deletes the person's stories and photos, takes back their likes and loves,
 * deletes their comments, reports and invites, ends every follow to and from
 * them and their blocks, deletes their profile, consent record, bell and the
 * record of the invite they joined through, and then the sign-in account.
 */
export async function deleteAccount(user: User) {
  await deleteAllMyStories(user);
  await deleteMyLikes(user);
  await deleteMyReactions(user);
  await deleteMyComments(user);
  await deleteMyReports(user);
  await deleteMyCommentReports(user);
  await deleteMyInvites(user);
  await deleteMyFollows(user);
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", user.uid));
  batch.delete(doc(db, "usersPrivate", user.uid));
  batch.delete(doc(db, "joins", user.uid));
  batch.delete(doc(db, "bells", user.uid));
  await batch.commit();
  // The counts of memories and comments shared, deleted with the consent
  // record gone. Rules from before a count was added refuse this, and then
  // there is none.
  await deleteDoc(doc(db, "postLimits", user.uid)).catch(() => {});
  await deleteDoc(doc(db, "commentLimits", user.uid)).catch(() => {});
  // Their profile page goes straight away too.
  await refreshPeople(user, [user.uid]);
  await deleteUser(user);
}
