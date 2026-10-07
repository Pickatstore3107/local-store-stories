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

const story = (authorId: string, status: string, visibility = "public") => ({
  authorId,
  storeName: "Ramu Tea Stall",
  category: "Tea Stalls",
  city: "Hyderabad",
  caption: "Cutting chai in steel glasses after every exam.",
  visibility,
  rightsConfirmed: true,
  status,
  photoId: `lss/stories/${authorId}/x`,
  createdAt: new Date(2026, 9, 1),
  updatedAt: new Date(2026, 9, 1),
});

const consent = () => ({
  consentVersion: CONSENT_VERSION,
  consentAt: serverTimestamp(),
  ageConfirmed: true,
});

// Ravi's approved memory "ramu" already has its three invites: "inv1" and
// "inv2" are unused, and Asha joined through "inv3". His memory "letters",
// shared only by link, has its invites "link1" to "link3". His memory "chai"
// is waiting for review and has no invites yet, nor has "diary", shared only
// by link. Priya hasn't joined.
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
    await setDoc(doc(db, "stories", "ramu"), story("ravi", "approved"));
    await setDoc(doc(db, "stories", "chai"), story("ravi", "pending"));
    await setDoc(doc(db, "stories", "bakery"), story("mallory", "approved"));
    await setDoc(doc(db, "stories", "letters"), story("ravi", "approved", "link"));
    await setDoc(doc(db, "stories", "diary"), story("ravi", "pending", "link"));
    const sets = { ramu: ["inv1", "inv2", "inv3"], letters: ["link1", "link2", "link3"] };
    for (const [storyId, codes] of Object.entries(sets)) {
      const visibility = storyId === "letters" ? "link" : "public";
      for (const code of codes) {
        await setDoc(doc(db, "invites", code), { from: "ravi", storyId, visibility, createdAt: at });
      }
      await setDoc(doc(db, "inviteSets", storyId), { from: "ravi", codes, createdAt: at });
    }
    await setDoc(doc(db, "invites", "inv3"), {
      from: "ravi",
      storyId: "ramu",
      visibility: "public",
      createdAt: at,
      usedBy: "asha",
      usedAt: at,
    });
  });
}

async function read(path: string) {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(asDb(ctx.firestore()), path))).data();
  });
  return data;
}

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

/** The batch "Pass the memory" writes: three invites and the memory's set. */
function makeInvites(
  db: Firestore,
  storyId: string,
  options: {
    codes?: string[];
    invites?: string[];
    from?: string;
    set?: Record<string, unknown> | null;
    invite?: Record<string, unknown>;
    leaveOut?: string;
  } = {},
) {
  const codes = options.codes ?? ["new1", "new2", "new3"];
  const batch = writeBatch(db);
  for (const code of options.invites ?? codes) {
    const invite: Record<string, unknown> = {
      from: options.from ?? "ravi",
      storyId,
      visibility: "public",
      createdAt: serverTimestamp(),
      ...options.invite,
    };
    if (options.leaveOut) delete invite[options.leaveOut];
    batch.set(doc(db, "invites", code), invite);
  }
  if (options.set !== null) {
    batch.set(doc(db, "inviteSets", storyId), {
      from: options.from ?? "ravi",
      codes,
      createdAt: serverTimestamp(),
      ...options.set,
    });
  }
  return batch.commit();
}

/** The batch the welcome screen writes when someone joins through an invite. */
function join(
  db: Firestore,
  uid: string,
  code: string,
  options: {
    profile?: Record<string, unknown>;
    use?: Record<string, unknown> | null;
    consent?: boolean;
    leaveOut?: string;
  } = {},
) {
  const batch = writeBatch(db);
  if (options.consent !== false) batch.set(doc(db, "usersPrivate", uid), consent());
  const profile: Record<string, unknown> = {
    displayName: "Priya",
    city: "Pune",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    invitedBy: "ravi",
    invitedVia: "ramu",
    inviteCode: code,
    ...options.profile,
  };
  if (options.leaveOut) delete profile[options.leaveOut];
  batch.set(doc(db, "users", uid), profile);
  if (options.use !== null) {
    batch.update(doc(db, "invites", code), {
      usedBy: uid,
      usedAt: serverTimestamp(),
      ...options.use,
    });
  }
  return batch.commit();
}

describe("making invites", () => {
  it("lets an author make three invites for their memory, even before review", async () => {
    await assertSucceeds(makeInvites(as("ravi"), "chai"));
  });

  it("refuses invites for someone else's memory", async () => {
    await assertFails(makeInvites(as("mallory"), "chai", { from: "mallory" }));
    await assertFails(makeInvites(as("mallory"), "chai"));
  });

  it("never gives a memory more than three", async () => {
    // "ramu" already has its set.
    await assertFails(makeInvites(as("ravi"), "ramu"));
    await assertFails(makeInvites(as("ravi"), "ramu", { set: null, invites: ["new1"] }));
    await assertFails(makeInvites(as("ravi"), "chai", { codes: ["a", "b", "c", "d"] }));
    await assertFails(
      makeInvites(as("ravi"), "chai", { codes: ["a", "b", "c"], invites: ["a", "b", "c", "d"] }),
    );
  });

  it("needs exactly three different invites, made together", async () => {
    await assertFails(makeInvites(as("ravi"), "chai", { codes: ["a", "b"] }));
    await assertFails(makeInvites(as("ravi"), "chai", { codes: ["a", "a", "b"], invites: ["a", "b"] }));
    await assertFails(
      makeInvites(as("ravi"), "chai", { codes: ["a", "b", "c", "c"], invites: ["a", "b", "c"] }),
    );
    await assertFails(makeInvites(as("ravi"), "chai", { codes: ["a", "b", "c"], invites: ["a", "b"] }));
    await assertFails(makeInvites(as("ravi"), "chai", { set: null }));
    // Another memory's invites can't fill this memory's set.
    await assertFails(
      makeInvites(as("ravi"), "chai", { codes: ["inv1", "inv2", "new1"], invites: ["new1"] }),
    );
  });

  it("records truly whether the memory is shared with everyone", async () => {
    await assertFails(makeInvites(as("ravi"), "chai", { invite: { visibility: "link" } }));
    await assertFails(makeInvites(as("ravi"), "chai", { leaveOut: "visibility" }));
    await assertFails(makeInvites(as("ravi"), "diary"));
    await assertSucceeds(makeInvites(as("ravi"), "diary", { invite: { visibility: "link" } }));
  });

  it("refuses fields people may not set, and back-dated times", async () => {
    await assertFails(makeInvites(as("ravi"), "chai", { invite: { usedBy: "asha" } }));
    await assertFails(makeInvites(as("ravi"), "chai", { invite: { createdAt: new Date(2020, 0, 1) } }));
    await assertFails(makeInvites(as("ravi"), "chai", { set: { createdAt: new Date(2020, 0, 1) } }));
    await assertFails(makeInvites(as("ravi"), "chai", { set: { from: "mallory" } }));
    await assertFails(makeInvites(as("ravi"), "chai", { invite: { from: "mallory" } }));
    await assertFails(makeInvites(as("ravi"), "chai", { set: { note: "for my school friends" } }));
  });

  it("needs consent, and a signed-in person", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(asDb(ctx.firestore()), "usersPrivate/ravi"));
    });
    await assertFails(makeInvites(as("ravi"), "chai"));
    await assertFails(makeInvites(visitor(), "chai"));
  });

  it("doesn't let anyone change an invite or a set", async () => {
    await assertFails(updateDoc(doc(as("ravi"), "invites/inv1"), { storyId: "chai" }));
    await assertFails(
      updateDoc(doc(as("ravi"), "inviteSets/ramu"), { codes: ["inv1", "inv2", "new1"] }),
    );
  });
});

describe("reading invites", () => {
  it("lets anyone with the link open an unused invite", async () => {
    await assertSucceeds(getDoc(doc(visitor(), "invites/inv1")));
    await assertSucceeds(getDoc(doc(as("mallory"), "invites/inv1")));
  });

  it("tells anyone that a code doesn't exist", async () => {
    const snapshot = await assertSucceeds(getDoc(doc(visitor(), "invites/nothing")));
    expect(snapshot.exists()).toBe(false);
  });

  it("shows who used an invite only to its sender and the person who used it", async () => {
    await assertSucceeds(getDoc(doc(as("ravi"), "invites/inv3")));
    await assertSucceeds(getDoc(doc(as("asha"), "invites/inv3")));
    await assertFails(getDoc(doc(as("mallory"), "invites/inv3")));
    await assertFails(getDoc(doc(visitor(), "invites/inv3")));
  });

  it("lets people list only their own invites", async () => {
    const mine = query(collection(as("ravi"), "invites"), where("from", "==", "ravi"));
    expect((await assertSucceeds(getDocs(mine))).size).toBe(6);
    const forStory = query(
      collection(as("ravi"), "invites"),
      where("from", "==", "ravi"),
      where("storyId", "==", "ramu"),
    );
    expect((await assertSucceeds(getDocs(forStory))).size).toBe(3);
    await assertFails(getDocs(query(collection(as("mallory"), "invites"), where("from", "==", "ravi"))));
    await assertFails(getDocs(collection(as("ravi"), "invites")));
    await assertFails(getDocs(query(collection(visitor(), "invites"), where("from", "==", "ravi"))));
  });

  it("keeps invite sets private to their author", async () => {
    await assertSucceeds(
      getDocs(query(collection(as("ravi"), "inviteSets"), where("from", "==", "ravi"))),
    );
    await assertFails(getDoc(doc(as("mallory"), "inviteSets/ramu")));
    await assertFails(getDoc(doc(visitor(), "inviteSets/ramu")));
    await assertFails(
      getDocs(query(collection(as("mallory"), "inviteSets"), where("from", "==", "ravi"))),
    );
  });
});

describe("joining through an invite", () => {
  it("links a new person to the friend who invited them", async () => {
    await assertSucceeds(join(as("priya"), "priya", "inv1"));
    expect(await read("users/priya")).toMatchObject({
      invitedBy: "ravi",
      invitedVia: "ramu",
      inviteCode: "inv1",
    });
    expect(await read("invites/inv1")).toMatchObject({ usedBy: "priya" });
  });

  it("names a memory shared only by link nowhere on the public profile", async () => {
    // Its address is the link's secret.
    await assertFails(join(as("priya"), "priya", "link1", { profile: { invitedVia: "letters" } }));
    await assertFails(join(as("priya"), "priya", "link1", { profile: { invitedVia: "ramu" } }));
    await assertSucceeds(join(as("priya"), "priya", "link1", { leaveOut: "invitedVia" }));
    const profile = await read("users/priya");
    expect(profile).toMatchObject({ invitedBy: "ravi", inviteCode: "link1" });
    expect(profile).not.toHaveProperty("invitedVia");
  });

  it("names a memory shared with everyone", async () => {
    await assertFails(join(as("priya"), "priya", "inv1", { leaveOut: "invitedVia" }));
    await assertFails(join(as("priya"), "priya", "inv1", { profile: { invitedVia: null } }));
  });

  it("lets each invite be used only once", async () => {
    await assertFails(join(as("priya"), "priya", "inv3"));
    await assertSucceeds(join(as("priya"), "priya", "inv1"));
    await assertFails(join(as("dev"), "dev", "inv1"));
    // Not even again by the person who used it.
    await assertFails(
      updateDoc(doc(as("priya"), "invites/inv1"), { usedBy: "priya", usedAt: serverTimestamp() }),
    );
    await deleteDoc(doc(as("priya"), "users/priya"));
    await assertFails(join(as("priya"), "priya", "inv1", { use: null }));
  });

  it("refuses a chain link without a real invite", async () => {
    // Claiming an inviter without using an invite.
    await assertFails(join(as("priya"), "priya", "inv1", { use: null }));
    await assertFails(join(as("priya"), "priya", "nothing", { use: null }));
    const db = as("priya");
    const withoutCode = writeBatch(db);
    withoutCode.set(doc(db, "usersPrivate/priya"), consent());
    withoutCode.set(doc(db, "users/priya"), {
      displayName: "Priya",
      city: "Pune",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      invitedBy: "ravi",
      invitedVia: "ramu",
    });
    await assertFails(withoutCode.commit());
  });

  it("refuses a link to someone other than the invite's sender or memory", async () => {
    await assertFails(join(as("priya"), "priya", "inv1", { profile: { invitedBy: "mallory" } }));
    await assertFails(join(as("priya"), "priya", "inv1", { profile: { invitedVia: "bakery" } }));
    await assertFails(join(as("priya"), "priya", "inv1", { profile: { inviteCode: "inv2" } }));
  });

  it("uses an invite only while creating a new profile", async () => {
    // Marking it used without joining.
    await assertFails(
      updateDoc(doc(as("priya"), "invites/inv1"), { usedBy: "priya", usedAt: serverTimestamp() }),
    );
    // Someone who already has an account.
    await assertFails(
      updateDoc(doc(as("mallory"), "invites/inv1"), { usedBy: "mallory", usedAt: serverTimestamp() }),
    );
    // Without consent, no profile can be made.
    await assertFails(join(as("priya"), "priya", "inv1", { consent: false }));
  });

  it("doesn't let an author use their own invite", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(asDb(ctx.firestore()), "users/ravi"));
    });
    await assertFails(join(as("ravi"), "ravi", "inv1"));
  });

  it("refuses invites for a memory that was deleted", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(asDb(ctx.firestore()), "stories/ramu"));
    });
    await assertFails(join(as("priya"), "priya", "inv1"));
  });

  it("records the use honestly, and changes nothing else", async () => {
    await assertFails(join(as("priya"), "priya", "inv1", { use: { usedBy: "dev" } }));
    await assertFails(join(as("priya"), "priya", "inv1", { use: { usedAt: new Date(2020, 0, 1) } }));
    await assertFails(join(as("priya"), "priya", "inv1", { use: { storyId: "chai" } }));
    await assertFails(join(as("priya"), "priya", "inv1", { use: { from: "priya" } }));
  });

  it("never lets anyone change who invited them", async () => {
    await assertSucceeds(join(as("priya"), "priya", "inv1"));
    const now = serverTimestamp();
    await assertSucceeds(updateDoc(doc(as("priya"), "users/priya"), { city: "Mumbai", updatedAt: now }));
    await assertFails(
      updateDoc(doc(as("priya"), "users/priya"), { invitedBy: "mallory", updatedAt: now }),
    );
    await assertFails(updateDoc(doc(as("priya"), "users/priya"), { invitedVia: "bakery", updatedAt: now }));
    await assertFails(
      updateDoc(doc(as("asha"), "users/asha"), {
        invitedBy: "ravi",
        invitedVia: "ramu",
        inviteCode: "inv2",
        updatedAt: now,
      }),
    );
  });
});

describe("taking invites back", () => {
  it("lets the author delete a memory's invites once the memory is gone", async () => {
    await assertFails(deleteDoc(doc(as("ravi"), "invites/inv1")));
    await assertFails(deleteDoc(doc(as("ravi"), "inviteSets/ramu")));
    await deleteDoc(doc(as("ravi"), "stories/ramu"));
    await assertSucceeds(deleteDoc(doc(as("ravi"), "invites/inv1")));
    await assertSucceeds(deleteDoc(doc(as("ravi"), "invites/inv3")));
    await assertSucceeds(deleteDoc(doc(as("ravi"), "inviteSets/ramu")));
  });

  it("doesn't let a deleted invite be made again", async () => {
    await deleteDoc(doc(as("ravi"), "stories/ramu"));
    await deleteDoc(doc(as("ravi"), "invites/inv3"));
    await assertFails(
      setDoc(doc(as("ravi"), "invites/inv3"), {
        from: "ravi",
        storyId: "ramu",
        visibility: "public",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("doesn't let anyone else delete them", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(asDb(ctx.firestore()), "stories/ramu"));
    });
    await assertFails(deleteDoc(doc(as("mallory"), "invites/inv1")));
    await assertFails(deleteDoc(doc(as("asha"), "invites/inv3")));
    await assertFails(deleteDoc(doc(as("mallory"), "inviteSets/ramu")));
    await assertFails(deleteDoc(doc(visitor(), "invites/inv1")));
  });
});
