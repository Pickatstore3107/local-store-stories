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

const longAgo = new Date(2026, 9, 1);

/**
 * Everyone but "newcomer" has given consent and has a profile, except
 * "shy", who has given consent but has no profile yet; "mod" is a moderator.
 */
async function seed(extra: Record<string, object> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = asDb(ctx.firestore());
    for (const uid of ["asha", "ravi", "mallory", "mod", "shy"]) {
      await setDoc(doc(db, "usersPrivate", uid), {
        consentVersion: CONSENT_VERSION,
        consentAt: longAgo,
        ageConfirmed: true,
      });
      if (uid !== "shy") {
        await setDoc(doc(db, "users", uid), {
          displayName: uid,
          city: "Hyderabad",
          createdAt: longAgo,
          updatedAt: longAgo,
        });
      }
    }
    await setDoc(doc(db, "moderators", "mod"), { name: "KO" });
    await setDoc(doc(db, "stories", "a1"), story("a1", "approved"));
    await setDoc(doc(db, "stories", "l1"), story("l1", "approved", { visibility: "link" }));
    await setDoc(doc(db, "stories", "p1"), story("p1", "pending"));
    await setDoc(doc(db, "stories", "h1"), story("h1", "hidden"));
    await setDoc(doc(db, "stories", "r1"), story("r1", "approved", { authorId: "ravi", photoId: "lss/stories/ravi/r1" }));
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

const likeRef = (db: Firestore, storyId: string, uid: string) => doc(db, "likes", `${storyId}_${uid}`);

/** The same batch the like button writes. */
function like(
  db: Firestore,
  uid: string,
  storyId: string,
  { by = 1, record = true, story: changes = {} as Record<string, unknown> } = {},
) {
  const batch = writeBatch(db);
  if (record) batch.set(likeRef(db, storyId, uid), { storyId, uid, at: serverTimestamp() });
  if (by) {
    batch.update(doc(db, "stories", storyId), { likeCount: increment(by), lastLikerId: uid, ...changes });
  }
  return batch.commit();
}

function unlike(db: Firestore, uid: string, storyId: string, wasLast: boolean, by = -1) {
  const batch = writeBatch(db);
  batch.delete(likeRef(db, storyId, uid));
  if (by) {
    batch.update(doc(db, "stories", storyId), {
      likeCount: increment(by),
      ...(wasLast && { lastLikerId: deleteField() }),
    });
  }
  return batch.commit();
}

describe("liking a memory", () => {
  beforeEach(() => seed());

  it("counts each person's like once and names the latest liker", async () => {
    await assertSucceeds(like(as("ravi"), "ravi", "a1"));
    await assertFails(like(as("ravi"), "ravi", "a1"));
    await assertSucceeds(like(as("mallory"), "mallory", "a1"));
    const after = await read("stories/a1");
    expect(after?.likeCount).toBe(2);
    expect(after?.lastLikerId).toBe("mallory");
    expect(await read("likes/a1_ravi")).toMatchObject({ storyId: "a1", uid: "ravi" });
  });

  it("likes memories shared by link, but not ones that aren't approved", async () => {
    await assertSucceeds(like(as("ravi"), "ravi", "l1"));
    await assertFails(like(as("ravi"), "ravi", "p1"));
    await assertFails(like(as("ravi"), "ravi", "h1"));
    await assertFails(like(as("ravi"), "ravi", "missing"));
  });

  it("keeps the count, the latest liker and the like in step", async () => {
    const db = as("ravi");
    await assertFails(like(db, "ravi", "a1", { record: false }));
    await assertFails(like(db, "ravi", "a1", { by: 0 }));
    await assertFails(like(db, "ravi", "a1", { by: 2 }));
    await assertFails(like(db, "ravi", "a1", { story: { lastLikerId: "mallory" } }));
    await assertFails(like(db, "mallory", "a1"));
    await assertFails(updateDoc(doc(db, "stories/a1"), { likeCount: 100 }));
    await assertFails(updateDoc(doc(db, "stories/a1"), { lastLikerId: "ravi" }));
  });

  it("doesn't let a like change anything else about the memory", async () => {
    const db = as("ravi");
    await assertFails(like(db, "ravi", "a1", { story: { caption: "Changed by someone else." } }));
    await assertFails(like(db, "ravi", "a1", { story: { status: "hidden" } }));
    await assertFails(like(db, "ravi", "a1", { story: { reactionCount: 5 } }));
  });

  it("refuses likes with extra fields, back-dated or with someone else's ID", async () => {
    const db = as("ravi");
    const withData = (id: string, data: Record<string, unknown>) => {
      const batch = writeBatch(db);
      batch.set(doc(db, "likes", id), data);
      batch.update(doc(db, "stories/a1"), { likeCount: increment(1), lastLikerId: "ravi" });
      return batch.commit();
    };
    await assertFails(withData("a1_ravi", { storyId: "a1", uid: "ravi", at: serverTimestamp(), name: "Ravi" }));
    await assertFails(withData("a1_ravi", { storyId: "a1", uid: "ravi", at: longAgo }));
    await assertFails(withData("a1_mallory", { storyId: "a1", uid: "ravi", at: serverTimestamp() }));
    await assertFails(withData("l1_ravi", { storyId: "a1", uid: "ravi", at: serverTimestamp() }));
  });

  it("needs consent and a sign-in", async () => {
    await assertFails(like(as("newcomer"), "newcomer", "a1"));
    await assertFails(updateDoc(doc(visitor(), "stories/a1"), { likeCount: increment(1) }));
  });

  it("doesn't count someone twice who loved the memory privately before", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = asDb(ctx.firestore());
      await setDoc(doc(db, "usersPrivate/ravi/reactions/a1"), { at: longAgo });
      await updateDoc(doc(db, "stories/a1"), { reactionCount: 1 });
    });
    await assertFails(like(as("ravi"), "ravi", "a1"));
    // Once they take the love back, they can like it.
    const db = as("ravi");
    const batch = writeBatch(db);
    batch.delete(doc(db, "usersPrivate/ravi/reactions/a1"));
    batch.update(doc(db, "stories/a1"), { reactionCount: increment(-1) });
    await assertSucceeds(batch.commit());
    await assertSucceeds(like(db, "ravi", "a1"));
  });

  it("lets anyone see who liked a memory", async () => {
    await assertSucceeds(like(as("ravi"), "ravi", "a1"));
    for (const db of [visitor(), as("mallory")]) {
      await assertSucceeds(getDoc(likeRef(db, "a1", "ravi")));
      await assertSucceeds(getDocs(query(collection(db, "likes"), where("storyId", "==", "a1"))));
    }
  });
});

describe("unliking a memory", () => {
  beforeEach(async () => {
    await seed();
    await like(as("ravi"), "ravi", "a1");
    await like(as("mallory"), "mallory", "a1");
  });

  it("takes one away and clears the latest liker if it was them", async () => {
    await assertSucceeds(unlike(as("mallory"), "mallory", "a1", true));
    let after = await read("stories/a1");
    expect(after?.likeCount).toBe(1);
    expect(after).not.toHaveProperty("lastLikerId");

    await assertSucceeds(like(as("mallory"), "mallory", "a1"));
    await assertSucceeds(unlike(as("ravi"), "ravi", "a1", false));
    after = await read("stories/a1");
    expect(after?.likeCount).toBe(1);
    expect(after?.lastLikerId).toBe("mallory");
  });

  it("doesn't let the latest liker be cleared by someone else, or kept by them", async () => {
    await assertFails(unlike(as("ravi"), "ravi", "a1", true));
    await assertFails(unlike(as("mallory"), "mallory", "a1", false));
  });

  it("keeps the count in step", async () => {
    await assertFails(unlike(as("ravi"), "ravi", "a1", false, 0));
    await assertFails(unlike(as("ravi"), "ravi", "a1", false, -2));
    await assertFails(updateDoc(doc(as("ravi"), "stories/a1"), { likeCount: increment(-1) }));
  });

  it("doesn't let anyone else take a like away", async () => {
    const db = as("asha");
    const batch = writeBatch(db);
    batch.delete(likeRef(db, "a1", "ravi"));
    batch.update(doc(db, "stories/a1"), { likeCount: increment(-1) });
    await assertFails(batch.commit());
    await assertFails(deleteDoc(likeRef(visitor(), "a1", "ravi")));
  });

  it("lets people tidy their likes away once the memory is deleted", async () => {
    await assertSucceeds(deleteDoc(doc(as("asha"), "stories/a1")));
    await assertSucceeds(deleteDoc(likeRef(as("ravi"), "a1", "ravi")));
  });

  it("still lets people unlike a memory after it is hidden", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(asDb(ctx.firestore()), "stories/a1"), { status: "hidden" });
    });
    await assertSucceeds(unlike(as("ravi"), "ravi", "a1", false));
  });
});

const commentRef = (db: Firestore, id: string) => doc(db, "comments", id);

/** The same batch the comment box writes. */
function comment(
  db: Firestore,
  uid: string,
  id: string,
  storyId: string,
  {
    text = "We went there after every exam.",
    by = 1,
    change = id,
    limit = { lastAt: serverTimestamp(), windowStart: serverTimestamp(), count: 1 } as Record<string, unknown> | null,
    extra = {} as Record<string, unknown>,
  } = {},
) {
  const batch = writeBatch(db);
  batch.set(commentRef(db, id), { storyId, authorId: uid, text, createdAt: serverTimestamp(), ...extra });
  if (by) batch.update(doc(db, "stories", storyId), { commentCount: increment(by), commentChange: change });
  if (limit) batch.set(doc(db, "commentLimits", uid), limit);
  return batch.commit();
}

function uncomment(db: Firestore, id: string, storyId: string, by = -1) {
  const batch = writeBatch(db);
  batch.delete(commentRef(db, id));
  if (by) batch.update(doc(db, "stories", storyId), { commentCount: increment(by), commentChange: id });
  return batch.commit();
}

describe("commenting on a memory", () => {
  beforeEach(() => seed());

  it("adds a comment and counts it", async () => {
    await assertSucceeds(comment(as("ravi"), "ravi", "c1", "a1"));
    expect(await read("stories/a1")).toMatchObject({ commentCount: 1, commentChange: "c1" });
    await assertSucceeds(comment(as("mallory"), "mallory", "c2", "a1"));
    expect((await read("stories/a1"))?.commentCount).toBe(2);
  });

  it("comments on memories shared by link, but not ones that aren't approved", async () => {
    await assertSucceeds(comment(as("ravi"), "ravi", "c1", "l1"));
    await assertFails(comment(as("mallory"), "mallory", "c2", "p1"));
    await assertFails(comment(as("mallory"), "mallory", "c3", "h1"));
  });

  it("refuses empty, long, linked and someone else's comments", async () => {
    const db = as("ravi");
    await assertFails(comment(db, "ravi", "c1", "a1", { text: "" }));
    await assertFails(comment(db, "ravi", "c1", "a1", { text: "   \n " }));
    await assertFails(comment(db, "ravi", "c1", "a1", { text: "x".repeat(501) }));
    await assertFails(comment(db, "ravi", "c1", "a1", { text: "Cheap phones at https://spam.example" }));
    await assertFails(comment(db, "ravi", "c1", "a1", { text: "Visit WWW.spam.example\ntoday" }));
    await assertFails(comment(db, "ravi", "c1", "a1", { text: "Line one\nHTTP://spam.example" }));
    await assertFails(comment(db, "mallory", "c1", "a1"));
    await assertFails(comment(db, "ravi", "c1", "a1", { extra: { likeCount: 5 } }));
    await assertSucceeds(comment(db, "ravi", "c1", "a1", { text: "x".repeat(500) }));
  });

  it("takes comments over several lines, in any language", async () => {
    await assertSucceeds(comment(as("ravi"), "ravi", "c1", "a1", { text: "Line one.\nरवि की बेकरी, మా ఊరి బేకరీ." }));
  });

  it("keeps the count in step with real comments", async () => {
    const db = as("ravi");
    await assertFails(comment(db, "ravi", "c1", "a1", { by: 0 }));
    await assertFails(comment(db, "ravi", "c1", "a1", { by: 2 }));
    await assertFails(comment(db, "ravi", "c1", "a1", { change: "other" }));
    await assertFails(updateDoc(doc(db, "stories/a1"), { commentCount: increment(1), commentChange: "c9" }));
    await assertFails(updateDoc(doc(db, "stories/a1"), { commentCount: 10 }));
    // A comment on another memory can't count here.
    await assertSucceeds(comment(db, "ravi", "c1", "l1"));
    await assertFails(updateDoc(doc(db, "stories/a1"), { commentCount: increment(-1), commentChange: "c1" }));
  });

  it("allows one comment every 10 seconds", async () => {
    await assertSucceeds(comment(as("ravi"), "ravi", "c1", "a1"));
    const limit = await read("commentLimits/ravi");
    await assertFails(
      comment(as("ravi"), "ravi", "c2", "a1", {
        limit: { lastAt: serverTimestamp(), windowStart: limit?.windowStart, count: 2 },
      }),
    );
    await assertFails(comment(as("ravi"), "ravi", "c2", "a1"));
    await assertFails(comment(as("ravi"), "ravi", "c2", "a1", { limit: null }));
  });

  it("allows 100 comments a day", async () => {
    const minuteAgo = new Date(Date.now() - 60_000);
    const hourAgo = new Date(Date.now() - 3_600_000);
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(asDb(ctx.firestore()), "commentLimits/ravi"), {
        lastAt: minuteAgo,
        windowStart: hourAgo,
        count: 99,
      });
    });
    await assertFails(comment(as("ravi"), "ravi", "c1", "a1"));
    await assertSucceeds(
      comment(as("ravi"), "ravi", "c1", "a1", {
        limit: { lastAt: serverTimestamp(), windowStart: hourAgo, count: 100 },
      }),
    );
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(asDb(ctx.firestore()), "commentLimits/ravi"), { lastAt: minuteAgo });
    });
    await assertFails(
      comment(as("ravi"), "ravi", "c2", "a1", {
        limit: { lastAt: serverTimestamp(), windowStart: hourAgo, count: 101 },
      }),
    );
    // A day after the count started, it starts again.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(asDb(ctx.firestore()), "commentLimits/ravi"), {
        windowStart: new Date(Date.now() - 25 * 3_600_000),
      });
    });
    await assertSucceeds(comment(as("ravi"), "ravi", "c2", "a1"));
  });

  it("needs consent, a profile and a sign-in", async () => {
    await assertFails(comment(as("newcomer"), "newcomer", "c1", "a1"));
    await assertFails(comment(as("shy"), "shy", "c1", "a1"));
    await assertFails(comment(visitor(), "nobody", "c1", "a1"));
  });

  it("doesn't let people comment on the memories of someone who blocked them", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(asDb(ctx.firestore()), "blocks/asha_mallory"), {
        from: "asha",
        to: "mallory",
        createdAt: longAgo,
      });
    });
    await assertFails(comment(as("mallory"), "mallory", "c1", "a1"));
    await assertSucceeds(comment(as("mallory"), "mallory", "c1", "r1"));
  });
});

describe("reading comments", () => {
  beforeEach(async () => {
    await seed();
    await comment(as("ravi"), "ravi", "c1", "a1");
    await comment(as("mallory"), "mallory", "c2", "l1");
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = asDb(ctx.firestore());
      await setDoc(doc(db, "comments/c3"), { storyId: "h1", authorId: "ravi", text: "Before it was hidden.", createdAt: longAgo });
    });
  });

  const onStory = (db: Firestore, storyId: string) =>
    getDocs(query(collection(db, "comments"), where("storyId", "==", storyId)));

  it("lets anyone read the comments of an approved memory", async () => {
    for (const db of [visitor(), as("asha"), as("newcomer")]) {
      await assertSucceeds(getDoc(commentRef(db, "c1")));
      await assertSucceeds(onStory(db, "a1"));
      await assertSucceeds(onStory(db, "l1"));
    }
  });

  it("hides the comments of a memory that isn't approved", async () => {
    for (const db of [visitor(), as("mallory")]) {
      await assertFails(getDoc(commentRef(db, "c3")));
      await assertFails(onStory(db, "h1"));
    }
  });

  it("lets their authors, the memory's author and moderators still find them", async () => {
    await assertSucceeds(getDocs(query(collection(as("ravi"), "comments"), where("authorId", "==", "ravi"))));
    await assertSucceeds(onStory(as("asha"), "h1"));
    await assertSucceeds(getDoc(commentRef(as("mod"), "c3")));
    await assertFails(getDocs(query(collection(as("mallory"), "comments"), where("authorId", "==", "ravi"))));
    await assertFails(getDocs(collection(visitor(), "comments")));
  });
});

describe("deleting comments", () => {
  beforeEach(async () => {
    await seed();
    await comment(as("ravi"), "ravi", "c1", "a1");
    await comment(as("mallory"), "mallory", "c2", "a1");
  });

  it("lets the comment's author, the memory's author and moderators delete it", async () => {
    await assertSucceeds(uncomment(as("ravi"), "c1", "a1"));
    await assertSucceeds(uncomment(as("asha"), "c2", "a1"));
    expect((await read("stories/a1"))?.commentCount).toBe(0);
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = asDb(ctx.firestore());
      await setDoc(doc(db, "comments/c3"), { storyId: "a1", authorId: "ravi", text: "Third.", createdAt: longAgo });
      await updateDoc(doc(db, "stories/a1"), { commentCount: 1 });
    });
    await assertSucceeds(uncomment(as("mod"), "c3", "a1"));
  });

  it("doesn't let anyone else delete it", async () => {
    await assertFails(uncomment(as("mallory"), "c1", "a1"));
    await assertFails(uncomment(visitor(), "c1", "a1"));
    await assertFails(uncomment(as("ravi"), "c2", "a1"));
  });

  it("keeps the count in step", async () => {
    await assertFails(uncomment(as("ravi"), "c1", "a1", 0));
    await assertFails(uncomment(as("ravi"), "c1", "a1", -2));
    const db = as("ravi");
    const batch = writeBatch(db);
    batch.delete(commentRef(db, "c1"));
    batch.update(doc(db, "stories/a1"), { commentCount: increment(-1), commentChange: "c2" });
    await assertFails(batch.commit());
  });

  it("lets the author delete a memory with all its likes and comments at once", async () => {
    await like(as("ravi"), "ravi", "a1");
    await like(as("mallory"), "mallory", "a1");
    const db = as("asha");
    const batch = writeBatch(db);
    for (const id of ["c1", "c2"]) batch.delete(commentRef(db, id));
    for (const uid of ["ravi", "mallory"]) batch.delete(likeRef(db, "a1", uid));
    batch.delete(doc(db, "stories/a1"));
    await assertSucceeds(batch.commit());
    expect(await read("comments/c1")).toBeUndefined();
    expect(await read("likes/a1_ravi")).toBeUndefined();
  });

  it("doesn't let the memory's author delete others' likes while keeping the memory", async () => {
    await like(as("ravi"), "ravi", "a1");
    await assertFails(deleteDoc(likeRef(as("asha"), "a1", "ravi")));
    await assertFails(deleteDoc(commentRef(as("asha"), "c1")));
  });

  it("lets people tidy their comments away once the memory is deleted", async () => {
    await assertSucceeds(deleteDoc(doc(as("asha"), "stories/a1")));
    await assertSucceeds(deleteDoc(commentRef(as("ravi"), "c1")));
    await assertFails(deleteDoc(commentRef(as("ravi"), "c2")));
  });
});

describe("reporting a comment", () => {
  beforeEach(async () => {
    await seed();
    await comment(as("mallory"), "mallory", "c1", "a1");
  });

  const report = (db: Firestore, uid: string, data: Record<string, unknown> = {}, id = `c1_${uid}`) =>
    setDoc(doc(db, "commentReports", id), {
      commentId: "c1",
      storyId: "a1",
      reason: "unkind",
      by: uid,
      at: serverTimestamp(),
      status: "open",
      ...data,
    });

  it("lets each member report a comment once", async () => {
    await assertSucceeds(report(as("ravi"), "ravi"));
    await assertFails(report(as("ravi"), "ravi", { reason: "spam" }));
    await assertSucceeds(report(as("asha"), "asha", { reason: "spam" }));
  });

  it("checks the reason, the details and whose report it is", async () => {
    const db = as("ravi");
    await assertFails(report(db, "ravi", { reason: "boring" }));
    await assertFails(report(db, "ravi", { reason: "other" }));
    await assertFails(report(db, "ravi", { by: "asha" }));
    await assertFails(report(db, "ravi", {}, "c1_asha"));
    await assertFails(report(db, "ravi", { storyId: "l1" }));
    await assertFails(report(db, "ravi", { status: "closed" }));
    await assertFails(report(db, "ravi", { commentId: "missing" }, "missing_ravi"));
    await assertSucceeds(report(db, "ravi", { reason: "other", details: "Selling something." }));
  });

  it("needs consent", async () => {
    await assertFails(report(as("newcomer"), "newcomer"));
    await assertFails(report(visitor(), "nobody"));
  });

  it("lets only moderators and the reporter read it", async () => {
    await report(as("ravi"), "ravi");
    await assertSucceeds(getDoc(doc(as("mod"), "commentReports/c1_ravi")));
    await assertSucceeds(getDocs(collection(as("mod"), "commentReports")));
    await assertSucceeds(getDocs(query(collection(as("ravi"), "commentReports"), where("by", "==", "ravi"))));
    for (const db of [as("mallory"), as("asha"), visitor()]) {
      await assertFails(getDoc(doc(db, "commentReports/c1_ravi")));
      await assertFails(getDocs(collection(db, "commentReports")));
    }
  });

  it("lets a moderator delete the comment and close the report together", async () => {
    await report(as("ravi"), "ravi");
    const db = as("mod");
    const close = (outcome: string) => ({
      status: "closed",
      outcome,
      closedBy: "mod",
      closedAt: serverTimestamp(),
    });
    await assertFails(updateDoc(doc(db, "commentReports/c1_ravi"), close("gone")));
    const batch = writeBatch(db);
    batch.delete(commentRef(db, "c1"));
    batch.update(doc(db, "stories/a1"), { commentCount: increment(-1), commentChange: "c1" });
    batch.update(doc(db, "commentReports/c1_ravi"), close("gone"));
    await assertSucceeds(batch.commit());
    expect(await read("comments/c1")).toBeUndefined();
  });

  it("lets a moderator keep the comment, and nobody else close the report", async () => {
    await report(as("ravi"), "ravi");
    const close = { status: "closed", outcome: "kept", closedBy: "mod", closedAt: serverTimestamp() };
    await assertFails(updateDoc(doc(as("asha"), "commentReports/c1_ravi"), { ...close, closedBy: "asha" }));
    await assertFails(updateDoc(doc(as("ravi"), "commentReports/c1_ravi"), { ...close, closedBy: "ravi" }));
    await assertSucceeds(updateDoc(doc(as("mod"), "commentReports/c1_ravi"), close));
  });

  it("lets reporters take their reports back", async () => {
    await report(as("ravi"), "ravi");
    await assertFails(deleteDoc(doc(as("mallory"), "commentReports/c1_ravi")));
    await assertSucceeds(deleteDoc(doc(as("ravi"), "commentReports/c1_ravi")));
  });
});

describe("the comment count", () => {
  beforeEach(() => seed());

  it("is read only by its owner and deleted only with the account", async () => {
    await comment(as("ravi"), "ravi", "c1", "a1");
    await assertSucceeds(getDoc(doc(as("ravi"), "commentLimits/ravi")));
    await assertFails(getDoc(doc(as("mallory"), "commentLimits/ravi")));
    await assertFails(deleteDoc(doc(as("ravi"), "commentLimits/ravi")));
    const db = as("ravi");
    const batch = writeBatch(db);
    batch.delete(doc(db, "usersPrivate/ravi"));
    batch.delete(doc(db, "commentLimits/ravi"));
    await assertSucceeds(batch.commit());
  });

  it("can't be started at more than one or back-dated", async () => {
    await assertFails(setDoc(doc(as("ravi"), "commentLimits/ravi"), { lastAt: serverTimestamp(), windowStart: serverTimestamp(), count: 0 }));
    await assertFails(setDoc(doc(as("ravi"), "commentLimits/ravi"), { lastAt: serverTimestamp(), windowStart: longAgo, count: 1 }));
  });
});
