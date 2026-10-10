import {
  assertFails,
  assertSucceeds,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
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

type Status = "pending" | "approved" | "rejected" | "hidden";

const story = (id: string, status: Status, overrides: Record<string, unknown> = {}) => ({
  authorId: "asha",
  storeName: "Ravi Bakery",
  category: "Bakeries",
  city: "Hyderabad",
  caption: "Osmania biscuits warm from the oven every Sunday.",
  visibility: "public",
  rightsConfirmed: true,
  status,
  photoId: `lss/stories/asha/${id}`,
  createdAt: new Date(2026, 9, 1),
  updatedAt: new Date(2026, 9, 1),
  ...(status === "rejected" || status === "hidden"
    ? { reviewNote: "Please keep it about the store.", reviewLogId: `old-${id}` }
    : {}),
  ...overrides,
});

/** Everyone but "newcomer" has given consent; "mod" is a moderator. */
async function seed(stories: Record<string, ReturnType<typeof story>>, extra: Record<string, object> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = asDb(ctx.firestore());
    for (const uid of ["asha", "ravi", "mallory", "mod"]) {
      await setDoc(doc(db, "usersPrivate", uid), {
        consentVersion: CONSENT_VERSION,
        consentAt: new Date(),
        ageConfirmed: true,
      });
    }
    await setDoc(doc(db, "moderators", "mod"), { name: "KO" });
    for (const [id, data] of Object.entries(stories)) await setDoc(doc(db, "stories", id), data);
    for (const [path, data] of Object.entries(extra)) await setDoc(doc(db, path), data);
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
});

/** Taking back a report: one off its post's count, unless it was never counted. */
const takeBack = (db: Firestore, uid: string, storyId: string, uncount = true) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, "reports", `${storyId}_${uid}`));
  if (uncount) batch.update(doc(db, "stories", storyId), { reportCount: increment(-1) });
  return batch.commit();
};

describe("featuring a memory", () => {
  beforeEach(() =>
    seed({
      a1: story("a1", "approved"),
      l1: story("l1", "approved", { visibility: "link" }),
      p1: story("p1", "pending"),
      h1: story("h1", "hidden"),
      f1: story("f1", "approved", { featuredAt: new Date(2026, 9, 2) }),
    }),
  );

  const feature = (db: Firestore, id: string, extra: Record<string, unknown> = {}) =>
    updateDoc(doc(db, "stories", id), { featuredAt: serverTimestamp(), ...extra });

  it("lets a moderator feature an approved memory and take it out again", async () => {
    await assertSucceeds(feature(as("mod"), "a1"));
    expect(await read("stories/a1")).toHaveProperty("featuredAt");
    await assertSucceeds(updateDoc(doc(as("mod"), "stories/f1"), { featuredAt: deleteField() }));
    expect(await read("stories/f1")).not.toHaveProperty("featuredAt");
  });

  it("features only memories that are on the Wall", async () => {
    for (const id of ["l1", "p1", "h1"]) await assertFails(feature(as("mod"), id));
  });

  it("doesn't let anyone else feature a memory, including its author", async () => {
    for (const db of [as("asha"), as("mallory"), visitor()]) {
      await assertFails(feature(db, "a1"));
      await assertFails(updateDoc(doc(db, "stories/f1"), { featuredAt: deleteField() }));
    }
  });

  it("refuses back-dated features and other changes at the same time", async () => {
    await assertFails(updateDoc(doc(as("mod"), "stories/a1"), { featuredAt: new Date(2030, 0, 1) }));
    await assertFails(feature(as("mod"), "a1", { caption: "Something else entirely." }));
    await assertFails(feature(as("mod"), "a1", { reactionCount: 100 }));
  });
});

describe("private loves from before likes were public", () => {
  beforeEach(() =>
    seed({
      a1: story("a1", "approved", { reactionCount: 1 }),
      h1: story("h1", "hidden", { reactionCount: 1 }),
    }, {
      // Ravi loved a1, and h1 before it was hidden.
      "usersPrivate/ravi/reactions/a1": { at: new Date(2026, 9, 2) },
      "usersPrivate/ravi/reactions/h1": { at: new Date(2026, 9, 2) },
    }),
  );

  const mine = (db: Firestore, uid: string, storyId: string) =>
    doc(db, "usersPrivate", uid, "reactions", storyId);

  /** The batch the memory page used to write. */
  function love(db: Firestore, uid: string, storyId: string, by = 1, record = true) {
    const batch = writeBatch(db);
    if (record) batch.set(mine(db, uid, storyId), { at: serverTimestamp() });
    if (by) batch.update(doc(db, "stories", storyId), { reactionCount: increment(by) });
    return batch.commit();
  }

  function unlove(db: Firestore, uid: string, storyId: string, by = -1, record = true) {
    const batch = writeBatch(db);
    if (record) batch.delete(mine(db, uid, storyId));
    if (by) batch.update(doc(db, "stories", storyId), { reactionCount: increment(by) });
    return batch.commit();
  }

  it("takes no new private loves", async () => {
    await assertFails(love(as("mallory"), "mallory", "a1"));
    await assertFails(love(as("mallory"), "mallory", "a1", 1, false));
    await assertFails(love(as("ravi"), "ravi", "a1"));
    expect((await read("stories/a1"))?.reactionCount).toBe(1);
  });

  it("lets people take their love back, once", async () => {
    await assertSucceeds(unlove(as("ravi"), "ravi", "a1"));
    expect((await read("stories/a1"))?.reactionCount).toBe(0);
    expect(await read("usersPrivate/ravi/reactions/a1")).toBeUndefined();
    await assertFails(unlove(as("ravi"), "ravi", "a1"));
  });

  it("keeps the count and the private record in step", async () => {
    const db = as("ravi");
    await assertFails(updateDoc(doc(db, "stories/a1"), { reactionCount: 100 }));
    await assertFails(unlove(db, "ravi", "a1", -1, false));
    await assertFails(unlove(db, "ravi", "a1", 0));
    await assertFails(unlove(db, "ravi", "a1", -2));
    await assertFails(unlove(as("mallory"), "mallory", "a1"));
  });

  it("doesn't let taking a love back change anything else about the memory", async () => {
    const db = as("ravi");
    const unloveAnd = (changes: Record<string, unknown>) => {
      const batch = writeBatch(db);
      batch.delete(mine(db, "ravi", "a1"));
      batch.update(doc(db, "stories/a1"), { reactionCount: increment(-1), ...changes });
      return batch.commit();
    };
    await assertFails(unloveAnd({ caption: "Changed by someone else." }));
    await assertFails(unloveAnd({ featuredAt: serverTimestamp() }));
    await assertFails(unloveAnd({ status: "hidden" }));
    await assertSucceeds(unloveAnd({}));
  });

  it("still lets people take back a love after the memory is hidden or deleted", async () => {
    await assertSucceeds(unlove(as("ravi"), "ravi", "h1"));
    expect((await read("stories/h1"))?.reactionCount).toBe(0);

    await assertSucceeds(deleteDoc(doc(as("asha"), "stories/a1")));
    await assertSucceeds(deleteDoc(mine(as("ravi"), "ravi", "a1")));
  });

  it("doesn't let anyone delete a record without its count while the memory exists", async () => {
    await assertFails(deleteDoc(mine(as("ravi"), "ravi", "a1")));
  });

  it("keeps who loved a memory private, even from its author and moderators", async () => {
    await assertSucceeds(getDoc(mine(as("ravi"), "ravi", "a1")));
    await assertSucceeds(getDocs(collection(as("ravi"), "usersPrivate/ravi/reactions")));
    for (const db of [as("asha"), as("mod"), as("mallory"), visitor()]) {
      await assertFails(getDoc(mine(db, "ravi", "a1")));
      await assertFails(getDocs(collection(db, "usersPrivate/ravi/reactions")));
    }
  });
});

describe("saving a place", () => {
  beforeEach(() => seed({ a1: story("a1", "approved") }));

  const saved = (db: Firestore, uid: string, storyId: string) => doc(db, "usersPrivate", uid, "saved", storyId);

  it("lets a member save and unsave a memory", async () => {
    const db = as("ravi");
    await assertSucceeds(setDoc(saved(db, "ravi", "a1"), { at: serverTimestamp() }));
    await assertSucceeds(getDocs(collection(db, "usersPrivate/ravi/saved")));
    await assertSucceeds(deleteDoc(saved(db, "ravi", "a1")));
  });

  it("keeps who saved a memory private, even from its author and moderators", async () => {
    await assertSucceeds(setDoc(saved(as("ravi"), "ravi", "a1"), { at: serverTimestamp() }));
    for (const db of [as("asha"), as("mod"), as("mallory"), visitor()]) {
      await assertFails(getDoc(saved(db, "ravi", "a1")));
      await assertFails(getDocs(collection(db, "usersPrivate/ravi/saved")));
      await assertFails(deleteDoc(saved(db, "ravi", "a1")));
    }
  });

  it("only saves for yourself, with the time it was saved and nothing else", async () => {
    await assertFails(setDoc(saved(as("mallory"), "ravi", "a1"), { at: serverTimestamp() }));
    await assertFails(setDoc(saved(visitor(), "ravi", "a1"), { at: serverTimestamp() }));
    await assertFails(setDoc(saved(as("ravi"), "ravi", "a1"), { at: new Date(2020, 0, 1) }));
    await assertFails(setDoc(saved(as("ravi"), "ravi", "a1"), { at: serverTimestamp(), note: "hi" }));
    await assertFails(setDoc(saved(as("ravi"), "ravi", "x".repeat(41)), { at: serverTimestamp() }));
  });

  it("needs consent first", async () => {
    await assertFails(setDoc(saved(as("newcomer"), "newcomer", "a1"), { at: serverTimestamp() }));
  });
});

describe("reporting a memory", () => {
  beforeEach(() =>
    seed({
      a1: story("a1", "approved"),
      l1: story("l1", "approved", { visibility: "link" }),
      p1: story("p1", "pending"),
      h1: story("h1", "hidden"),
    }),
  );

  /** The batch the post page writes: the report, counted on the post. */
  const report = (
    db: Firestore,
    uid: string,
    storyId: string,
    overrides: Record<string, unknown> = {},
    id = `${storyId}_${uid}`,
    onStory: Record<string, unknown> | null = { reportCount: increment(1) },
  ) => {
    const batch = writeBatch(db);
    const data = {
      storyId,
      reason: "private",
      by: uid,
      at: serverTimestamp(),
      status: "open",
      counted: true,
      ...overrides,
    };
    // An override of undefined leaves that field out.
    batch.set(doc(db, "reports", id), Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
    if (onStory) batch.update(doc(db, "stories", storyId), onStory);
    return batch.commit();
  };

  it("lets a person who gave consent report an approved memory, once", async () => {
    await assertSucceeds(report(as("ravi"), "ravi", "a1"));
    await assertFails(report(as("ravi"), "ravi", "a1", { reason: "unkind" }));
    await assertSucceeds(report(as("mallory"), "mallory", "a1", { details: "It shows my phone number." }));
    await assertSucceeds(report(as("ravi"), "ravi", "l1", { reason: "other", details: "Wrong city." }));
  });

  it("only takes reports about memories people can see", async () => {
    for (const id of ["p1", "h1", "missing"]) await assertFails(report(as("ravi"), "ravi", id));
  });

  it("needs consent and a sign-in", async () => {
    await assertFails(report(as("newcomer"), "newcomer", "a1"));
    await assertFails(report(visitor(), "ravi", "a1"));
  });

  it("checks what a report says", async () => {
    const db = as("ravi");
    await assertFails(report(db, "ravi", "a1", { reason: "boring" }));
    await assertFails(report(db, "ravi", "a1", { reason: "other" }));
    await assertFails(report(db, "ravi", "a1", { reason: "other", details: "no" }));
    await assertFails(report(db, "ravi", "a1", { details: "" }));
    await assertFails(report(db, "ravi", "a1", { details: "x".repeat(501) }));
    await assertFails(report(db, "ravi", "a1", { status: "closed" }));
    await assertFails(report(db, "ravi", "a1", { at: new Date(2020, 0, 1) }));
    await assertFails(report(db, "ravi", "a1", { by: "mallory" }));
    await assertFails(report(db, "ravi", "a1", { name: "Ravi" }));
    await assertFails(report(db, "ravi", "a1", {}, "a1_mallory"));
    await assertFails(report(db, "ravi", "a1", {}, "a1"));
    await assertFails(report(db, "ravi", "a1", { storyId: "l1" }));
  });

  it("counts each report on the post, in the same batch", async () => {
    await assertSucceeds(report(as("ravi"), "ravi", "a1"));
    await assertSucceeds(report(as("mallory"), "mallory", "a1"));
    expect(await read("stories/a1")).toMatchObject({ status: "approved", reportCount: 2 });
  });

  it("refuses a report that isn't counted, or is counted wrongly", async () => {
    const db = as("ravi");
    await assertFails(report(db, "ravi", "a1", {}, undefined, null));
    await assertFails(report(db, "ravi", "a1", { counted: false }));
    await assertFails(report(db, "ravi", "a1", { counted: undefined }));
    await assertFails(report(db, "ravi", "a1", {}, undefined, { reportCount: increment(2) }));
    await assertFails(report(db, "ravi", "a1", {}, undefined, { reportCount: 1, caption: "Changed it." }));
    await assertFails(report(db, "ravi", "a1", {}, undefined, { reportCount: increment(1), status: "pending" }));
  });

  it("refuses changing the count without a report", async () => {
    await assertFails(updateDoc(doc(as("ravi"), "stories/a1"), { reportCount: increment(1) }));
    await assertFails(updateDoc(doc(as("asha"), "stories/a1"), { reportCount: 0 }));
    await assertSucceeds(report(as("ravi"), "ravi", "a1"));
    await assertFails(updateDoc(doc(as("ravi"), "stories/a1"), { reportCount: increment(1) }));
    await assertFails(updateDoc(doc(as("asha"), "stories/a1"), { reportCount: increment(-1) }));
  });

  it("takes a post off the site at the third report, until a moderator looks", async () => {
    await seed({ a2: story("a2", "approved", { reportCount: 2 }) });
    await assertFails(report(as("ravi"), "ravi", "a2"));
    await assertFails(
      report(as("ravi"), "ravi", "a2", {}, undefined, { reportCount: increment(1), status: "hidden" }),
    );
    await assertSucceeds(
      report(as("ravi"), "ravi", "a2", {}, undefined, { reportCount: increment(1), status: "pending" }),
    );
    expect(await read("stories/a2")).toMatchObject({ status: "pending", reportCount: 3 });
    await assertFails(getDoc(doc(visitor(), "stories/a2")));
    await assertFails(report(as("mallory"), "mallory", "a2"));
  });

  it("takes one off the count when an open report is taken back", async () => {
    await assertSucceeds(report(as("ravi"), "ravi", "a1"));
    await assertFails(takeBack(as("ravi"), "ravi", "a1", false));
    await assertFails(takeBack(as("mallory"), "ravi", "a1"));
    await assertSucceeds(takeBack(as("ravi"), "ravi", "a1"));
    expect((await read("stories/a1"))?.reportCount).toBe(0);
    // Reporting again counts once, so nobody can hold a post back alone.
    await assertSucceeds(report(as("ravi"), "ravi", "a1"));
    expect((await read("stories/a1"))?.reportCount).toBe(1);
  });

  it("takes back a report about a post that's gone, or one that was never counted", async () => {
    await seed(
      { a2: story("a2", "approved", { reportCount: 1 }) },
      {
        "reports/a2_ravi": { storyId: "a2", reason: "unkind", by: "ravi", at: new Date(2026, 9, 3), status: "open" },
        "reports/gone_ravi": {
          storyId: "gone",
          reason: "unkind",
          by: "ravi",
          at: new Date(2026, 9, 3),
          status: "open",
          counted: true,
        },
      },
    );
    await assertSucceeds(takeBack(as("ravi"), "ravi", "a2", false));
    expect((await read("stories/a2"))?.reportCount).toBe(1);
    await assertSucceeds(takeBack(as("ravi"), "ravi", "gone", false));
  });

  it("lets a moderator start a post's count again, and nobody else", async () => {
    await seed({ a2: story("a2", "approved", { reportCount: 2 }) });
    await assertFails(updateDoc(doc(as("asha"), "stories/a2"), { reportCount: deleteField() }));
    await assertFails(updateDoc(doc(as("mod"), "stories/a2"), { reportCount: 0 }));
    await assertSucceeds(updateDoc(doc(as("mod"), "stories/a2"), { reportCount: deleteField() }));
  });

  it("shows reports only to moderators and to the person who sent them", async () => {
    await assertSucceeds(report(as("ravi"), "ravi", "a1"));
    const reports = (db: Firestore) => collection(db, "reports");

    await assertSucceeds(getDoc(doc(as("mod"), "reports/a1_ravi")));
    await assertSucceeds(getDocs(query(reports(as("mod")), where("status", "==", "open"))));

    const mine = await assertSucceeds(
      getDocs(query(reports(as("ravi")), where("by", "==", "ravi"), where("storyId", "==", "a1"))),
    );
    expect(mine.size).toBe(1);

    for (const db of [as("asha"), as("mallory"), visitor()]) {
      await assertFails(getDoc(doc(db, "reports/a1_ravi")));
      await assertFails(getDocs(reports(db)));
      await assertFails(getDocs(query(reports(db), where("storyId", "==", "a1"))));
    }
    await assertFails(getDocs(query(reports(as("mallory")), where("by", "==", "ravi"))));
  });

  it("lets people take back their own report, and nobody else's", async () => {
    await assertSucceeds(report(as("ravi"), "ravi", "a1"));
    for (const db of [as("mallory"), as("asha"), as("mod"), visitor()]) {
      await assertFails(deleteDoc(doc(db, "reports/a1_ravi")));
    }
    await assertSucceeds(takeBack(as("ravi"), "ravi", "a1"));
  });

  it("doesn't let the reporter change a report", async () => {
    await assertSucceeds(report(as("ravi"), "ravi", "a1"));
    await assertFails(updateDoc(doc(as("ravi"), "reports/a1_ravi"), { reason: "unkind" }));
    await assertFails(updateDoc(doc(as("ravi"), "reports/a1_ravi"), { status: "closed" }));
  });
});

describe("closing reports", () => {
  const open = (storyId: string, by: string) => ({
    [`reports/${storyId}_${by}`]: {
      storyId,
      reason: "unkind",
      by,
      at: new Date(2026, 9, 3),
      status: "open",
    },
  });

  beforeEach(() =>
    seed(
      { a1: story("a1", "approved"), h1: story("h1", "hidden") },
      {
        ...open("a1", "ravi"),
        ...open("a1", "mallory"),
        ...open("a1", "asha"),
        ...open("h1", "ravi"),
        ...open("gone", "ravi"),
      },
    ),
  );

  const close = (db: Firestore, id: string, outcome: string, extra: Record<string, unknown> = {}) =>
    updateDoc(doc(db, "reports", id), {
      status: "closed",
      outcome,
      closedBy: "mod",
      closedAt: serverTimestamp(),
      ...extra,
    });

  it("lets a moderator keep a memory up after a look", async () => {
    await assertSucceeds(close(as("mod"), "a1_ravi", "kept"));
    expect(await read("reports/a1_ravi")).toMatchObject({ status: "closed", outcome: "kept", closedBy: "mod" });
    await assertFails(close(as("mod"), "a1_ravi", "kept"));
  });

  it("puts a held post back up and closes its reports in one batch", async () => {
    const counted = (by: string) => ({
      [`reports/held_${by}`]: { storyId: "held", reason: "unkind", by, at: new Date(2026, 9, 3), status: "open", counted: true },
    });
    await seed(
      { held: story("held", "pending", { reportCount: 3 }) },
      { ...counted("ravi"), ...counted("mallory"), ...counted("asha") },
    );
    const db = as("mod");
    const keep = (approve: boolean) => {
      const batch = writeBatch(db);
      if (approve) {
        batch.update(doc(db, "stories/held"), {
          status: "approved",
          reviewedAt: serverTimestamp(),
          reviewLogId: "L3",
          updatedAt: serverTimestamp(),
          reportCount: deleteField(),
        });
        batch.set(doc(db, "moderationLog/L3"), {
          storyId: "held",
          storeName: "Ravi Bakery",
          action: "approved",
          from: "pending",
          by: "mod",
          at: serverTimestamp(),
        });
      }
      for (const by of ["ravi", "mallory", "asha"]) {
        batch.update(doc(db, "reports", `held_${by}`), {
          status: "closed",
          outcome: "kept",
          closedBy: "mod",
          closedAt: serverTimestamp(),
        });
      }
      return batch.commit();
    };
    await assertFails(keep(false));
    await assertSucceeds(keep(true));
    expect(await read("stories/held")).toMatchObject({ status: "approved" });
    expect(await read("stories/held")).not.toHaveProperty("reportCount");
    // A closed report is taken back without changing the count.
    await assertSucceeds(takeBack(as("ravi"), "ravi", "held", false));
  });

  it("closes reports with the outcome that really happened", async () => {
    const db = as("mod");
    await assertFails(close(db, "a1_ravi", "hidden"));
    await assertFails(close(db, "a1_ravi", "gone"));
    await assertFails(close(db, "a1_ravi", "deleted"));
    await assertFails(close(db, "h1_ravi", "kept"));
    await assertSucceeds(close(db, "h1_ravi", "hidden"));
    await assertFails(close(db, "gone_ravi", "kept"));
    await assertSucceeds(close(db, "gone_ravi", "gone"));
  });

  it("hides a memory and closes all its reports in one batch", async () => {
    const db = as("mod");
    const batch = writeBatch(db);
    batch.update(doc(db, "stories/a1"), {
      status: "hidden",
      reviewedAt: serverTimestamp(),
      reviewNote: "Please keep your story kind about the real people in it.",
      reviewLogId: "L1",
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, "moderationLog/L1"), {
      storyId: "a1",
      storeName: "Ravi Bakery",
      action: "hidden",
      from: "approved",
      by: "mod",
      at: serverTimestamp(),
      note: "Please keep your story kind about the real people in it.",
    });
    for (const by of ["ravi", "mallory", "asha"]) {
      batch.update(doc(db, "reports", `a1_${by}`), {
        status: "closed",
        outcome: "hidden",
        closedBy: "mod",
        closedAt: serverTimestamp(),
      });
    }
    await assertSucceeds(batch.commit());
    expect((await read("stories/a1"))?.status).toBe("hidden");
    expect((await read("reports/a1_asha"))?.outcome).toBe("hidden");
  });

  it("closes many reports in the same batch as hiding", async () => {
    const reporters = Array.from({ length: 30 }, (_, i) => `reader${i}`);
    await seed(
      { a2: story("a2", "approved") },
      Object.assign({}, ...reporters.map((by) => open("a2", by))),
    );
    const db = as("mod");
    const batch = writeBatch(db);
    batch.update(doc(db, "stories/a2"), {
      status: "hidden",
      reviewedAt: serverTimestamp(),
      reviewNote: "Please keep your story kind about the real people in it.",
      reviewLogId: "L2",
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, "moderationLog/L2"), {
      storyId: "a2",
      storeName: "Ravi Bakery",
      action: "hidden",
      from: "approved",
      by: "mod",
      at: serverTimestamp(),
      note: "Please keep your story kind about the real people in it.",
    });
    for (const by of reporters) {
      batch.update(doc(db, "reports", `a2_${by}`), {
        status: "closed",
        outcome: "hidden",
        closedBy: "mod",
        closedAt: serverTimestamp(),
      });
    }
    await assertSucceeds(batch.commit());
    expect((await read("reports/a2_reader29"))?.outcome).toBe("hidden");
  });

  it("refuses closing by anyone but a moderator, and other changes", async () => {
    for (const uid of ["ravi", "asha", "mallory"]) {
      await assertFails(close(as(uid), "a1_ravi", "kept", { closedBy: uid }));
    }
    const db = as("mod");
    await assertFails(close(db, "a1_ravi", "kept", { closedBy: "ravi" }));
    await assertFails(close(db, "a1_ravi", "kept", { closedAt: new Date(2020, 0, 1) }));
    await assertFails(close(db, "a1_ravi", "kept", { reason: "other" }));
    await assertFails(close(db, "a1_ravi", "kept", { status: "open" }));
    await assertFails(deleteDoc(doc(db, "reports/a1_ravi")));
  });
});
