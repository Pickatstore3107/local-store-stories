import {
  assertFails,
  assertSucceeds,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONSENT_VERSION, startRulesEnv } from "./setup";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await startRulesEnv();
});
afterAll(async () => {
  await env?.cleanup();
});

type TestDb = ReturnType<RulesTestContext["firestore"]>;
const asDb = (testDb: TestDb) => testDb as unknown as Firestore;
const as = (uid: string) => asDb(env.authenticatedContext(uid).firestore());
const visitor = () => asDb(env.unauthenticatedContext().firestore());

// Ravi, Asha and Mallory have profiles; Neha has signed in but not finished
// joining. Asha follows Ravi, Ravi has blocked Mallory, and Ravi's memory
// "ramu" has the invite link "inv1".
async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = asDb(ctx.firestore());
    const at = new Date(2026, 9, 2);
    for (const uid of ["ravi", "asha", "mallory"]) {
      await setDoc(doc(db, "usersPrivate", uid), {
        consentVersion: CONSENT_VERSION,
        consentAt: at,
        ageConfirmed: true,
      });
      await setDoc(doc(db, "users", uid), {
        displayName: uid,
        city: "Hyderabad",
        createdAt: at,
        updatedAt: at,
      });
    }
    await setDoc(doc(db, "follows", "asha_ravi"), { from: "asha", to: "ravi", createdAt: at });
    await setDoc(doc(db, "blocks", "ravi_mallory"), { from: "ravi", to: "mallory", createdAt: at });
    await setDoc(doc(db, "bells", "ravi"), { seenAt: at });
    await setDoc(doc(db, "stories", "ramu"), {
      authorId: "ravi",
      storeName: "Ramu Tea Stall",
      category: "Tea Stalls",
      city: "Hyderabad",
      caption: "Cutting chai in steel glasses after every exam.",
      visibility: "public",
      rightsConfirmed: true,
      status: "approved",
      photoId: "lss/stories/ravi/ramu",
      createdAt: at,
      updatedAt: at,
    });
    await setDoc(doc(db, "invites", "inv1"), {
      from: "ravi",
      storyId: "ramu",
      visibility: "public",
      createdAt: at,
    });
    await setDoc(doc(db, "inviteSets", "ramu"), { from: "ravi", codes: ["inv1"], createdAt: at });
  });
}

async function exists(path: string) {
  let found = false;
  await env.withSecurityRulesDisabled(async (ctx) => {
    found = (await getDoc(doc(asDb(ctx.firestore()), path))).exists();
  });
  return found;
}

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

/** What the Follow button writes: the follow, and a ring of their bell. */
function follow(
  db: Firestore,
  from: string,
  to: string,
  options: {
    id?: string;
    data?: Record<string, unknown>;
    leaveOut?: string;
    /** What's written to their bell, or false to leave it. */
    bell?: Record<string, unknown> | false;
  } = {},
) {
  const data: Record<string, unknown> = { from, to, createdAt: serverTimestamp(), ...options.data };
  if (options.leaveOut) delete data[options.leaveOut];
  const batch = writeBatch(db);
  batch.set(doc(db, "follows", options.id ?? `${from}_${to}`), data);
  if (options.bell !== false) {
    batch.set(doc(db, "bells", to), options.bell ?? { ringAt: serverTimestamp() }, { merge: true });
  }
  return batch.commit();
}

/** What Block writes: the block, and the end of any follow either way. */
function block(
  db: Firestore,
  from: string,
  to: string,
  options: { id?: string; data?: Record<string, unknown>; keep?: ("theirs" | "mine")[] } = {},
) {
  const batch = writeBatch(db);
  batch.set(doc(db, "blocks", options.id ?? `${from}_${to}`), {
    from,
    to,
    createdAt: serverTimestamp(),
    ...options.data,
  });
  if (!options.keep?.includes("theirs")) batch.delete(doc(db, "follows", `${to}_${from}`));
  if (!options.keep?.includes("mine")) batch.delete(doc(db, "follows", `${from}_${to}`));
  return batch.commit();
}

const followersOf = (db: Firestore, uid: string) =>
  query(collection(db, "follows"), where("to", "==", uid));

describe("seeing who follows whom", () => {
  it("lets anyone, even signed out, see followers and who someone follows", async () => {
    const db = visitor();
    await assertSucceeds(getDoc(doc(db, "follows", "asha_ravi")));
    await assertSucceeds(getDocs(followersOf(db, "ravi")));
    await assertSucceeds(getDocs(query(collection(db, "follows"), where("from", "==", "asha"))));
    const count = await assertSucceeds(getCountFromServer(followersOf(db, "ravi")));
    expect(count.data().count).toBe(1);
  });
});

describe("following someone", () => {
  // Each refusal below is checked without the bell, so the bell's own rule
  // can't be what refuses it.
  it("lets a member follow someone and ring their bell", async () => {
    await assertSucceeds(follow(as("asha"), "asha", "mallory"));
    expect(await exists("follows/asha_mallory")).toBe(true);
  });

  it("lets a member follow someone without ringing the bell", async () => {
    await assertSucceeds(follow(as("mallory"), "mallory", "asha", { bell: false }));
  });

  it("doesn't let anyone follow on someone else's behalf", async () => {
    await assertFails(follow(as("asha"), "mallory", "asha", { bell: false }));
    await assertFails(follow(as("asha"), "asha", "mallory", { data: { from: "mallory" }, bell: false }));
  });

  it("needs the follow's ID to name the follower and the person followed", async () => {
    await assertFails(follow(as("asha"), "asha", "mallory", { id: "asha_ravi2", bell: false }));
    await assertFails(follow(as("asha"), "asha", "mallory", { id: "mallory_asha", bell: false }));
    await assertFails(follow(as("asha"), "asha", "mallory", { id: "anything", bell: false }));
  });

  it("doesn't let people follow themselves", async () => {
    await assertFails(follow(as("asha"), "asha", "asha", { bell: false }));
  });

  it("needs a profile on both sides", async () => {
    await assertFails(follow(as("asha"), "asha", "nobody", { bell: false }));
    await assertFails(follow(as("neha"), "neha", "ravi", { bell: false }));
  });

  it("doesn't let signed-out visitors follow", async () => {
    await assertFails(follow(visitor(), "asha", "mallory", { bell: false }));
  });

  it("accepts only the follower, the person followed and the time", async () => {
    await assertFails(follow(as("asha"), "asha", "mallory", { data: { note: "hi" }, bell: false }));
    await assertFails(follow(as("asha"), "asha", "mallory", { leaveOut: "createdAt", bell: false }));
    await assertFails(follow(as("asha"), "asha", "mallory", { leaveOut: "to", bell: false }));
    await assertFails(
      follow(as("asha"), "asha", "mallory", { data: { createdAt: new Date(2026, 0, 1) }, bell: false }),
    );
  });

  it("doesn't let a blocked person follow the person who blocked them, or the other way round", async () => {
    await assertFails(follow(as("mallory"), "mallory", "ravi", { bell: false }));
    await assertFails(follow(as("ravi"), "ravi", "mallory", { bell: false }));
  });

  it("lets them follow again once unblocked", async () => {
    await assertSucceeds(deleteDoc(doc(as("ravi"), "blocks", "ravi_mallory")));
    await assertSucceeds(follow(as("mallory"), "mallory", "ravi"));
  });

  it("never changes a follow, so nobody follows twice", async () => {
    await assertFails(follow(as("asha"), "asha", "ravi", { bell: false }));
    await assertFails(updateDoc(doc(as("asha"), "follows", "asha_ravi"), { createdAt: serverTimestamp() }));
  });
});

describe("unfollowing and removing followers", () => {
  it("lets the follower unfollow", async () => {
    await assertSucceeds(deleteDoc(doc(as("asha"), "follows", "asha_ravi")));
  });

  it("lets the person followed remove a follower", async () => {
    await assertSucceeds(deleteDoc(doc(as("ravi"), "follows", "asha_ravi")));
  });

  it("doesn't let anyone else end a follow", async () => {
    await assertFails(deleteDoc(doc(as("mallory"), "follows", "asha_ravi")));
    await assertFails(deleteDoc(doc(visitor(), "follows", "asha_ravi")));
  });

  it("lets a member clear a follow that isn't there, which changes nothing", async () => {
    await assertSucceeds(deleteDoc(doc(as("mallory"), "follows", "mallory_asha")));
    await assertFails(deleteDoc(doc(visitor(), "follows", "mallory_asha")));
  });
});

describe("joining through an invite link", () => {
  it("follows the link's sender in the same batch that creates the profile", async () => {
    const db = as("priya");
    const batch = writeBatch(db);
    batch.set(doc(db, "usersPrivate", "priya"), {
      consentVersion: CONSENT_VERSION,
      consentAt: serverTimestamp(),
      ageConfirmed: true,
    });
    batch.set(doc(db, "users", "priya"), {
      displayName: "Priya",
      city: "Pune",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      invitedBy: "ravi",
      invitedVia: "ramu",
    });
    batch.set(doc(db, "joins", "priya"), {
      inviteCode: "inv1",
      invitedBy: "ravi",
      joinedAt: serverTimestamp(),
    });
    batch.set(doc(db, "follows", "priya_ravi"), {
      from: "priya",
      to: "ravi",
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, "bells", "ravi"), { ringAt: serverTimestamp() }, { merge: true });
    await assertSucceeds(batch.commit());
  });

  it("only with consent from this version of the welcome screen", async () => {
    const db = as("priya");
    const batch = writeBatch(db);
    batch.set(doc(db, "usersPrivate", "priya"), {
      consentVersion: "2026-10-v2",
      consentAt: serverTimestamp(),
      ageConfirmed: true,
    });
    batch.set(doc(db, "users", "priya"), {
      displayName: "Priya",
      city: "Pune",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });
});

describe("blocking someone", () => {
  it("lets a member block someone, ending any follow between them", async () => {
    await assertSucceeds(block(as("ravi"), "ravi", "asha"));
    expect(await exists("follows/asha_ravi")).toBe(false);
    expect(await exists("blocks/ravi_asha")).toBe(true);
  });

  it("works when neither follows the other", async () => {
    await assertSucceeds(block(as("asha"), "asha", "mallory"));
  });

  it("needs any follow either way to end in the same batch", async () => {
    await assertFails(block(as("ravi"), "ravi", "asha", { keep: ["theirs"] }));
    await assertFails(block(as("asha"), "asha", "ravi", { keep: ["mine"] }));
  });

  it("doesn't let anyone block on someone else's behalf, or block themselves", async () => {
    await assertFails(block(as("asha"), "mallory", "asha"));
    await assertFails(block(as("asha"), "asha", "mallory", { data: { from: "mallory" } }));
    await assertFails(block(as("asha"), "asha", "asha"));
    await assertFails(block(visitor(), "asha", "mallory"));
  });

  it("needs the block's ID to name both people, and nothing else in it", async () => {
    await assertFails(block(as("asha"), "asha", "mallory", { id: "mallory_asha" }));
    await assertFails(block(as("asha"), "asha", "mallory", { data: { reason: "rude" } }));
    await assertFails(
      block(as("asha"), "asha", "mallory", { data: { createdAt: new Date(2026, 0, 1) } }),
    );
  });

  it("needs a profile", async () => {
    await assertFails(block(as("neha"), "neha", "ravi"));
  });

  it("is seen only by the person who blocked", async () => {
    await assertSucceeds(getDoc(doc(as("ravi"), "blocks", "ravi_mallory")));
    await assertSucceeds(
      getDocs(query(collection(as("ravi"), "blocks"), where("from", "==", "ravi"))),
    );
    // Whether you've blocked someone, even when you haven't.
    await assertSucceeds(getDoc(doc(as("asha"), "blocks", "asha_ravi")));
    await assertFails(getDoc(doc(as("mallory"), "blocks", "ravi_mallory")));
    await assertFails(
      getDocs(query(collection(as("mallory"), "blocks"), where("to", "==", "mallory"))),
    );
    await assertFails(getDoc(doc(visitor(), "blocks", "ravi_mallory")));
  });

  it("can be undone only by the person who blocked", async () => {
    await assertFails(deleteDoc(doc(as("mallory"), "blocks", "ravi_mallory")));
    await assertSucceeds(deleteDoc(doc(as("ravi"), "blocks", "ravi_mallory")));
  });

  it("never changes", async () => {
    await assertFails(updateDoc(doc(as("ravi"), "blocks", "ravi_mallory"), { to: "asha" }));
  });
});

describe("the bell", () => {
  it("is read only by its owner", async () => {
    await assertSucceeds(getDoc(doc(as("ravi"), "bells", "ravi")));
    await assertFails(getDoc(doc(as("asha"), "bells", "ravi")));
    await assertFails(getDoc(doc(visitor(), "bells", "ravi")));
  });

  it("rings when someone follows them, whether or not it has rung before", async () => {
    await assertSucceeds(follow(as("mallory"), "mallory", "asha"));
    await assertSucceeds(deleteDoc(doc(as("ravi"), "blocks", "ravi_mallory")));
    await assertSucceeds(follow(as("mallory"), "mallory", "ravi"));
  });

  it("can't be rung without following them in the same batch", async () => {
    await assertFails(setDoc(doc(as("asha"), "bells", "mallory"), { ringAt: serverTimestamp() }));
    // Asha already follows Ravi.
    await assertFails(
      setDoc(doc(as("asha"), "bells", "ravi"), { ringAt: serverTimestamp() }, { merge: true }),
    );
  });

  it("can only be rung, not marked seen, by someone else", async () => {
    const both = { ringAt: serverTimestamp(), seenAt: serverTimestamp() };
    // Mallory has no bell yet; Ravi has one.
    await assertFails(follow(as("asha"), "asha", "mallory", { bell: both }));
    await assertSucceeds(deleteDoc(doc(as("asha"), "follows", "asha_ravi")));
    await assertFails(follow(as("asha"), "asha", "ravi", { bell: both }));
  });

  it("rings only at the time of following", async () => {
    const backDated = { ringAt: new Date(2026, 0, 1) };
    await assertFails(follow(as("asha"), "asha", "mallory", { bell: backDated }));
    await assertSucceeds(deleteDoc(doc(as("asha"), "follows", "asha_ravi")));
    await assertFails(follow(as("asha"), "asha", "ravi", { bell: backDated }));
  });

  it("is marked seen by its owner, at the time they look", async () => {
    const at = (when: unknown) => ({ seenAt: when });
    await assertSucceeds(setDoc(doc(as("ravi"), "bells", "ravi"), at(serverTimestamp()), { merge: true }));
    await assertFails(setDoc(doc(as("ravi"), "bells", "ravi"), at(new Date(2026, 0, 1)), { merge: true }));
    // Asha has no bell yet.
    await assertFails(setDoc(doc(as("asha"), "bells", "asha"), at(new Date(2026, 0, 1))));
    await assertSucceeds(setDoc(doc(as("asha"), "bells", "asha"), at(serverTimestamp())));
  });

  it("can't be rung by its owner", async () => {
    await assertFails(
      setDoc(doc(as("ravi"), "bells", "ravi"), { ringAt: serverTimestamp() }, { merge: true }),
    );
    const both = { seenAt: serverTimestamp(), ringAt: serverTimestamp() };
    await assertFails(setDoc(doc(as("ravi"), "bells", "ravi"), both, { merge: true }));
    // Asha has no bell yet.
    await assertFails(setDoc(doc(as("asha"), "bells", "asha"), both));
  });

  it("is deleted only by its owner", async () => {
    await assertFails(deleteDoc(doc(as("asha"), "bells", "ravi")));
    await assertSucceeds(deleteDoc(doc(as("ravi"), "bells", "ravi")));
  });
});
