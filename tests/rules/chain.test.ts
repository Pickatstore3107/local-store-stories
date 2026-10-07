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

// Ravi's approved memory "ramu" has its invite link "inv1", and his memory
// "letters", shared only by link, has "link1". His memory "chai" is waiting
// for review and has no link yet, nor has "diary", shared only by link. His
// memory "kulfi" is from before shared links: it has three invites that
// worked once each, and Asha joined through "old3". Priya hasn't joined.
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
        ...(uid === "asha" && { invitedBy: "ravi", invitedVia: "kulfi", inviteCode: "old3" }),
      });
    }
    await setDoc(doc(db, "stories", "ramu"), story("ravi", "approved"));
    await setDoc(doc(db, "stories", "chai"), story("ravi", "pending"));
    await setDoc(doc(db, "stories", "bakery"), story("mallory", "approved"));
    await setDoc(doc(db, "stories", "letters"), story("ravi", "approved", "link"));
    await setDoc(doc(db, "stories", "diary"), story("ravi", "pending", "link"));
    await setDoc(doc(db, "stories", "kulfi"), story("ravi", "approved"));
    const sets = { ramu: ["inv1"], letters: ["link1"], kulfi: ["old1", "old2", "old3"] };
    for (const [storyId, codes] of Object.entries(sets)) {
      const visibility = storyId === "letters" ? "link" : "public";
      for (const code of codes) {
        await setDoc(doc(db, "invites", code), { from: "ravi", storyId, visibility, createdAt: at });
      }
      await setDoc(doc(db, "inviteSets", storyId), { from: "ravi", codes, createdAt: at });
    }
    await setDoc(doc(db, "invites", "old3"), {
      from: "ravi",
      storyId: "kulfi",
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

/** The batch "Pass the memory" writes: the memory's invite and its set. */
function makeInvite(
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
  const codes = options.codes ?? ["new1"];
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

/**
 * The batch the welcome screen writes when someone joins through an invite
 * link: their consent, their profile, and the private record of the link.
 */
function join(
  db: Firestore,
  uid: string,
  code: string,
  options: {
    profile?: Record<string, unknown>;
    record?: Record<string, unknown> | null;
    consent?: boolean;
    /** Left out of the profile. */
    leaveOut?: string[];
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
    ...options.profile,
  };
  const record: Record<string, unknown> = {
    inviteCode: code,
    invitedBy: "ravi",
    joinedAt: serverTimestamp(),
    ...options.record,
  };
  for (const key of options.leaveOut ?? []) delete profile[key];
  batch.set(doc(db, "users", uid), profile);
  if (options.record !== null) batch.set(doc(db, "joins", uid), record);
  return batch.commit();
}

const joinedBy = (db: Firestore, uid: string) =>
  query(collection(db, "joins"), where("invitedBy", "==", uid));

describe("making a memory's invite link", () => {
  it("lets an author make their memory's link, even before review", async () => {
    await assertSucceeds(makeInvite(as("ravi"), "chai"));
  });

  it("refuses a link for someone else's memory", async () => {
    await assertFails(makeInvite(as("mallory"), "chai", { from: "mallory" }));
    await assertFails(makeInvite(as("mallory"), "chai"));
  });

  it("gives a memory only one link, made once", async () => {
    // "ramu" already has its set.
    await assertFails(makeInvite(as("ravi"), "ramu"));
    await assertFails(makeInvite(as("ravi"), "ramu", { set: null }));
    await assertFails(makeInvite(as("ravi"), "chai", { codes: ["a", "b"] }));
    await assertFails(makeInvite(as("ravi"), "chai", { codes: ["a"], invites: ["a", "b"] }));
    await assertFails(makeInvite(as("ravi"), "chai", { codes: [] }));
    await assertFails(makeInvite(as("ravi"), "chai", { set: null }));
  });

  it("needs the link and the memory's set made together", async () => {
    await assertFails(makeInvite(as("ravi"), "chai", { codes: ["a"], invites: [] }));
    // Another memory's link can't fill this memory's set.
    await assertFails(makeInvite(as("ravi"), "chai", { codes: ["inv1"], invites: [] }));
    await assertFails(makeInvite(as("ravi"), "chai", { set: { codes: "new1" } }));
  });

  it("records truly whether the memory is shared with everyone", async () => {
    await assertFails(makeInvite(as("ravi"), "chai", { invite: { visibility: "link" } }));
    await assertFails(makeInvite(as("ravi"), "chai", { leaveOut: "visibility" }));
    await assertFails(makeInvite(as("ravi"), "diary"));
    await assertSucceeds(makeInvite(as("ravi"), "diary", { invite: { visibility: "link" } }));
  });

  it("refuses fields people may not set, and back-dated times", async () => {
    await assertFails(makeInvite(as("ravi"), "chai", { invite: { usedBy: "asha" } }));
    await assertFails(makeInvite(as("ravi"), "chai", { invite: { createdAt: new Date(2020, 0, 1) } }));
    await assertFails(makeInvite(as("ravi"), "chai", { set: { createdAt: new Date(2020, 0, 1) } }));
    await assertFails(makeInvite(as("ravi"), "chai", { set: { from: "mallory" } }));
    await assertFails(makeInvite(as("ravi"), "chai", { invite: { from: "mallory" } }));
    await assertFails(makeInvite(as("ravi"), "chai", { set: { note: "for my school friends" } }));
  });

  it("needs consent, and a signed-in person", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(asDb(ctx.firestore()), "usersPrivate/ravi"));
    });
    await assertFails(makeInvite(as("ravi"), "chai"));
    await assertFails(makeInvite(visitor(), "chai"));
  });

  it("doesn't let anyone change a link or a set, or mark a link used", async () => {
    await assertFails(updateDoc(doc(as("ravi"), "invites/inv1"), { storyId: "chai" }));
    await assertFails(updateDoc(doc(as("ravi"), "inviteSets/ramu"), { codes: ["new1"] }));
    await assertFails(
      updateDoc(doc(as("mallory"), "invites/inv1"), { usedBy: "mallory", usedAt: serverTimestamp() }),
    );
  });
});

describe("reading invite links", () => {
  it("lets anyone with the link open it, however many people joined through it", async () => {
    await assertSucceeds(getDoc(doc(visitor(), "invites/inv1")));
    await assertSucceeds(join(as("priya"), "priya", "inv1"));
    await assertSucceeds(join(as("dev"), "dev", "inv1"));
    await assertSucceeds(getDoc(doc(visitor(), "invites/inv1")));
    await assertSucceeds(getDoc(doc(as("mallory"), "invites/inv1")));
    expect(await read("invites/inv1")).not.toHaveProperty("usedBy");
  });

  it("tells anyone that a code doesn't exist", async () => {
    const snapshot = await assertSucceeds(getDoc(doc(visitor(), "invites/nothing")));
    expect(snapshot.exists()).toBe(false);
  });

  it("keeps a used invite from before shared links private to the two people it connects", async () => {
    await assertSucceeds(getDoc(doc(as("ravi"), "invites/old3")));
    await assertSucceeds(getDoc(doc(as("asha"), "invites/old3")));
    await assertFails(getDoc(doc(as("mallory"), "invites/old3")));
    await assertFails(getDoc(doc(visitor(), "invites/old3")));
    await assertSucceeds(getDoc(doc(visitor(), "invites/old1")));
  });

  it("lets people list only their own links", async () => {
    const mine = query(collection(as("ravi"), "invites"), where("from", "==", "ravi"));
    expect((await assertSucceeds(getDocs(mine))).size).toBe(5);
    const forStory = query(
      collection(as("ravi"), "invites"),
      where("from", "==", "ravi"),
      where("storyId", "==", "ramu"),
    );
    expect((await assertSucceeds(getDocs(forStory))).size).toBe(1);
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

describe("joining through an invite link", () => {
  it("links a new person to the friend who invited them", async () => {
    await assertSucceeds(join(as("priya"), "priya", "inv1"));
    const profile = await read("users/priya");
    expect(profile).toMatchObject({ invitedBy: "ravi", invitedVia: "ramu" });
    expect(await read("joins/priya")).toMatchObject({ inviteCode: "inv1", invitedBy: "ravi" });
  });

  it("lets any number of people join through the same link", async () => {
    for (const uid of ["priya", "dev", "sam"]) {
      await assertSucceeds(join(as(uid), uid, "inv1"));
    }
    await assertSucceeds(join(as("lata"), "lata", "link1", { leaveOut: ["invitedVia"] }));
  });

  it("keeps the link itself off the public profile", async () => {
    // Anyone could read it there, and join through it, or find a link-only memory.
    await assertFails(join(as("priya"), "priya", "inv1", { profile: { inviteCode: "inv1" } }));
    await assertSucceeds(join(as("priya"), "priya", "inv1"));
    expect(await read("users/priya")).not.toHaveProperty("inviteCode");
  });

  it("names a memory shared only by link nowhere on the public profile", async () => {
    // Its address is the link's secret.
    await assertFails(join(as("priya"), "priya", "link1", { profile: { invitedVia: "letters" } }));
    await assertFails(join(as("priya"), "priya", "link1", { profile: { invitedVia: "ramu" } }));
    await assertSucceeds(join(as("priya"), "priya", "link1", { leaveOut: ["invitedVia"] }));
    const profile = await read("users/priya");
    expect(profile).toMatchObject({ invitedBy: "ravi" });
    expect(profile).not.toHaveProperty("invitedVia");
  });

  it("names a memory shared with everyone", async () => {
    await assertFails(join(as("priya"), "priya", "inv1", { leaveOut: ["invitedVia"] }));
    await assertFails(join(as("priya"), "priya", "inv1", { profile: { invitedVia: null } }));
  });

  it("refuses a chain link without a real invite link", async () => {
    // Naming an inviter without the private record of their link.
    await assertFails(join(as("priya"), "priya", "inv1", { record: null }));
    await assertFails(join(as("priya"), "priya", "inv1", { leaveOut: ["invitedBy"], record: null }));
    await assertFails(join(as("priya"), "priya", "nothing"));
    // Or the other way round: a record of a link the public profile doesn't show.
    await assertFails(join(as("priya"), "priya", "inv1", { leaveOut: ["invitedBy", "invitedVia"] }));
    await assertFails(join(as("priya"), "priya", "inv1", { profile: { invitedBy: null } }));
  });

  it("refuses a link to someone other than the link's sender or memory", async () => {
    await assertFails(join(as("priya"), "priya", "inv1", { profile: { invitedBy: "mallory" } }));
    await assertFails(
      join(as("priya"), "priya", "inv1", {
        profile: { invitedBy: "mallory" },
        record: { invitedBy: "mallory" },
      }),
    );
    await assertFails(join(as("priya"), "priya", "inv1", { profile: { invitedVia: "bakery" } }));
    await assertFails(join(as("priya"), "priya", "inv1", { profile: { invitedVia: "chai" } }));
  });

  it("records the join honestly, with nothing else in it", async () => {
    await assertFails(join(as("priya"), "priya", "inv1", { record: { joinedAt: new Date(2020, 0, 1) } }));
    await assertFails(join(as("priya"), "priya", "inv1", { record: { note: "hi" } }));
    await assertFails(join(as("priya"), "priya", "inv1", { record: { inviteCode: null } }));
    const db = as("priya");
    const withoutTime = writeBatch(db);
    withoutTime.set(doc(db, "usersPrivate/priya"), consent());
    withoutTime.set(doc(db, "users/priya"), {
      displayName: "Priya",
      city: "Pune",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      invitedBy: "ravi",
      invitedVia: "ramu",
    });
    withoutTime.set(doc(db, "joins/priya"), { inviteCode: "inv1", invitedBy: "ravi" });
    await assertFails(withoutTime.commit());
  });

  it("joins only while creating a new profile", async () => {
    // Asha joined before shared links, so she has no record. She can't add one now.
    await assertFails(
      setDoc(doc(as("asha"), "joins/asha"), {
        inviteCode: "inv1",
        invitedBy: "ravi",
        joinedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(as("mallory"), "joins/mallory"), {
        inviteCode: "inv1",
        invitedBy: "ravi",
        joinedAt: serverTimestamp(),
      }),
    );
    // Without consent, no profile can be made.
    await assertFails(join(as("priya"), "priya", "inv1", { consent: false }));
    // Nor for someone else.
    await assertFails(join(as("mallory"), "priya", "inv1"));
  });

  it("doesn't let an author join through their own link", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(asDb(ctx.firestore()), "users/ravi"));
    });
    await assertFails(join(as("ravi"), "ravi", "inv1"));
  });

  it("refuses links for a memory that was deleted", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(asDb(ctx.firestore()), "stories/ramu"));
    });
    await assertFails(join(as("priya"), "priya", "inv1"));
  });

  it("keeps a used invite from before shared links used, and the others open", async () => {
    const via = { profile: { invitedVia: "kulfi" } };
    await assertFails(join(as("priya"), "priya", "old3", via));
    await assertSucceeds(join(as("priya"), "priya", "old1", via));
    await assertSucceeds(join(as("dev"), "dev", "old1", via));
  });

  it("never lets anyone change how they joined", async () => {
    await assertSucceeds(join(as("priya"), "priya", "inv1"));
    const now = serverTimestamp();
    await assertSucceeds(updateDoc(doc(as("priya"), "users/priya"), { city: "Mumbai", updatedAt: now }));
    await assertFails(
      updateDoc(doc(as("priya"), "users/priya"), { invitedBy: "mallory", updatedAt: now }),
    );
    await assertFails(updateDoc(doc(as("priya"), "users/priya"), { invitedVia: "bakery", updatedAt: now }));
    await assertFails(updateDoc(doc(as("priya"), "joins/priya"), { inviteCode: "link1" }));
    await assertFails(deleteDoc(doc(as("priya"), "joins/priya")));
    await assertFails(
      updateDoc(doc(as("mallory"), "users/mallory"), {
        invitedBy: "ravi",
        invitedVia: "ramu",
        updatedAt: now,
      }),
    );
    // A new profile still names the friend from the record.
    await deleteDoc(doc(as("priya"), "users/priya"));
    const again = (profile: Record<string, unknown>) =>
      setDoc(doc(as("priya"), "users/priya"), {
        displayName: "Priya",
        city: "Pune",
        createdAt: now,
        updatedAt: now,
        ...profile,
      });
    await assertFails(again({ invitedBy: "mallory", invitedVia: "ramu" }));
    await assertSucceeds(again({ invitedBy: "ravi", invitedVia: "ramu" }));
  });
});

describe("who joined through a link", () => {
  it("shows the friend who sent it, and the person who joined", async () => {
    await join(as("priya"), "priya", "inv1");
    await join(as("dev"), "dev", "link1", { leaveOut: ["invitedVia"] });
    const joined = await assertSucceeds(getDocs(joinedBy(as("ravi"), "ravi")));
    expect(joined.docs.map((d) => d.id).sort()).toEqual(["dev", "priya"]);
    await assertSucceeds(getDoc(doc(as("ravi"), "joins/priya")));
    await assertSucceeds(getDoc(doc(as("priya"), "joins/priya")));
  });

  it("keeps it from everyone else", async () => {
    await join(as("priya"), "priya", "inv1");
    await assertFails(getDoc(doc(as("mallory"), "joins/priya")));
    await assertFails(getDoc(doc(as("dev"), "joins/priya")));
    await assertFails(getDoc(doc(visitor(), "joins/priya")));
    await assertFails(getDocs(joinedBy(as("mallory"), "ravi")));
    await assertFails(getDocs(collection(as("ravi"), "joins")));
    await assertFails(getDocs(joinedBy(visitor(), "ravi")));
  });

  it("tells people when they didn't join through a link", async () => {
    const snapshot = await assertSucceeds(getDoc(doc(as("mallory"), "joins/mallory")));
    expect(snapshot.exists()).toBe(false);
  });
});

describe("taking invites back", () => {
  it("lets the author delete a memory's links once the memory is gone", async () => {
    await assertFails(deleteDoc(doc(as("ravi"), "invites/inv1")));
    await assertFails(deleteDoc(doc(as("ravi"), "inviteSets/ramu")));
    await deleteDoc(doc(as("ravi"), "stories/ramu"));
    await assertSucceeds(deleteDoc(doc(as("ravi"), "invites/inv1")));
    await assertSucceeds(deleteDoc(doc(as("ravi"), "inviteSets/ramu")));
    await deleteDoc(doc(as("ravi"), "stories/kulfi"));
    await assertSucceeds(deleteDoc(doc(as("ravi"), "invites/old3")));
  });

  it("doesn't let a deleted link be made again", async () => {
    await deleteDoc(doc(as("ravi"), "stories/ramu"));
    await deleteDoc(doc(as("ravi"), "invites/inv1"));
    await assertFails(
      setDoc(doc(as("ravi"), "invites/inv1"), {
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
    await assertFails(deleteDoc(doc(as("mallory"), "inviteSets/ramu")));
    await assertFails(deleteDoc(doc(visitor(), "invites/inv1")));
  });

  it("deletes how someone joined together with their account", async () => {
    await join(as("priya"), "priya", "inv1");
    const db = as("priya");
    const batch = writeBatch(db);
    batch.delete(doc(db, "users/priya"));
    batch.delete(doc(db, "usersPrivate/priya"));
    batch.delete(doc(db, "joins/priya"));
    await assertSucceeds(batch.commit());
    expect((await getDocs(joinedBy(as("ravi"), "ravi"))).size).toBe(0);
  });

  it("doesn't let anyone else delete how someone joined", async () => {
    await join(as("priya"), "priya", "inv1");
    await assertFails(deleteDoc(doc(as("ravi"), "joins/priya")));
    await deleteDoc(doc(as("priya"), "users/priya"));
    await assertFails(deleteDoc(doc(as("ravi"), "joins/priya")));
    await assertFails(deleteDoc(doc(visitor(), "joins/priya")));
  });
});
