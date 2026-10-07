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

type Status = "pending" | "approved" | "rejected" | "hidden";

const story = (id: string, status: Status, overrides: Record<string, unknown> = {}) => ({
  authorId: "asha",
  storeName: "Sharma Tea Stall",
  category: "Tea Stalls",
  city: "Pune",
  caption: "Cutting chai after every exam, with my best friends.",
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

async function seed(stories: Record<string, ReturnType<typeof story>>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = asDb(ctx.firestore());
    for (const uid of ["asha", "mallory", "mod"]) {
      await setDoc(doc(db, "usersPrivate", uid), {
        consentVersion: CONSENT_VERSION,
        consentAt: new Date(),
        ageConfirmed: true,
      });
    }
    await setDoc(doc(db, "moderators", "mod"), { name: "KO" });
    for (const [id, data] of Object.entries(stories)) {
      await setDoc(doc(db, "stories", id), data);
    }
  });
}

type Review = {
  action: "approved" | "rejected" | "hidden";
  from: Status;
  note?: string;
  logId?: string;
  /** Extra or changed fields on the story. */
  story?: Record<string, unknown>;
  /** Extra or changed fields on the log entry. */
  log?: Record<string, unknown>;
  writeStory?: boolean;
  writeLog?: boolean;
};

let logCount = 0;

/** The same batch the review page writes. */
function review(db: Firestore, storyId: string, by: string, r: Review) {
  const logId = r.logId ?? `log${++logCount}`;
  const batch = writeBatch(db);
  if (r.writeStory !== false) {
    batch.update(doc(db, "stories", storyId), {
      status: r.action,
      reviewedAt: serverTimestamp(),
      reviewNote: r.note ?? deleteField(),
      reviewLogId: logId,
      updatedAt: serverTimestamp(),
      ...r.story,
    });
  }
  if (r.writeLog !== false) {
    batch.set(doc(db, "moderationLog", logId), {
      storyId,
      storeName: "Sharma Tea Stall",
      action: r.action,
      from: r.from,
      by,
      at: serverTimestamp(),
      ...(r.note !== undefined && { note: r.note }),
      ...r.log,
    });
  }
  return batch.commit();
}

const NOTE = "Please share a memory of a local store.";

beforeEach(async () => {
  await env.clearFirestore();
});

describe("moderators", () => {
  beforeEach(() => seed({}));

  it("lets people check only whether they themselves are a moderator", async () => {
    await assertSucceeds(getDoc(doc(as("mod"), "moderators/mod")));
    await assertSucceeds(getDoc(doc(as("asha"), "moderators/asha")));
    await assertFails(getDoc(doc(as("asha"), "moderators/mod")));
    await assertFails(getDocs(collection(as("mod"), "moderators")));
  });

  it("doesn't let anyone make themselves or others a moderator", async () => {
    await assertFails(setDoc(doc(as("asha"), "moderators/asha"), { name: "Asha" }));
    await assertFails(setDoc(doc(as("mod"), "moderators/asha"), { name: "Asha" }));
    await assertFails(deleteDoc(doc(as("mod"), "moderators/mod")));
  });
});

describe("reviewing a story", () => {
  beforeEach(() =>
    seed({
      s1: story("s1", "pending"),
      a1: story("a1", "approved", { reviewLogId: "old-a1" }),
      r1: story("r1", "rejected"),
      h1: story("h1", "hidden"),
    }),
  );

  it("lets a moderator approve a story, logged in the same batch", async () => {
    await assertSucceeds(review(as("mod"), "s1", "mod", { action: "approved", from: "pending", logId: "L1" }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = asDb(ctx.firestore());
      const saved = (await getDoc(doc(db, "stories/s1"))).data()!;
      expect(saved.status).toBe("approved");
      expect(saved.reviewLogId).toBe("L1");
      expect(saved).not.toHaveProperty("reviewedBy");
      const entry = (await getDoc(doc(db, "moderationLog/L1"))).data()!;
      expect(entry).toMatchObject({ storyId: "s1", action: "approved", from: "pending", by: "mod" });
    });
  });

  it("lets a moderator turn a story down or hide it, with a note for the author", async () => {
    const db = as("mod");
    await assertSucceeds(review(db, "s1", "mod", { action: "rejected", from: "pending", note: NOTE }));
    await assertSucceeds(review(db, "a1", "mod", { action: "hidden", from: "approved", note: NOTE }));
  });

  it("lets a moderator approve a story they turned down or hid", async () => {
    const db = as("mod");
    await assertSucceeds(review(db, "r1", "mod", { action: "approved", from: "rejected" }));
    await assertSucceeds(review(db, "h1", "mod", { action: "approved", from: "hidden" }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      const saved = (await getDoc(doc(asDb(ctx.firestore()), "stories/h1"))).data()!;
      expect(saved).not.toHaveProperty("reviewNote");
    });
  });

  it("allows only the expected moves between statuses", async () => {
    const db = as("mod");
    await assertFails(review(db, "s1", "mod", { action: "hidden", from: "pending", note: NOTE }));
    await assertFails(review(db, "a1", "mod", { action: "rejected", from: "approved", note: NOTE }));
    await assertFails(review(db, "a1", "mod", { action: "approved", from: "approved" }));
    await assertFails(review(db, "r1", "mod", { action: "hidden", from: "rejected", note: NOTE }));
  });

  it("requires a note to turn down or hide, and none to approve", async () => {
    const db = as("mod");
    await assertFails(review(db, "s1", "mod", { action: "rejected", from: "pending" }));
    await assertFails(review(db, "s1", "mod", { action: "rejected", from: "pending", note: "no" }));
    await assertFails(
      review(db, "s1", "mod", { action: "rejected", from: "pending", note: "x".repeat(301) }),
    );
    await assertFails(review(db, "s1", "mod", { action: "approved", from: "pending", note: NOTE }));
    await assertFails(review(db, "a1", "mod", { action: "hidden", from: "approved" }));
  });

  it("refuses everyone who is not a moderator, including the author", async () => {
    await assertFails(review(as("asha"), "s1", "asha", { action: "approved", from: "pending" }));
    await assertFails(review(as("mallory"), "s1", "mallory", { action: "approved", from: "pending" }));
    await assertFails(review(visitor(), "s1", "mod", { action: "approved", from: "pending" }));
    await assertFails(updateDoc(doc(as("asha"), "stories/s1"), { status: "approved" }));
  });

  it("refuses a review that isn't logged, and a log entry without a review", async () => {
    const db = as("mod");
    await assertFails(review(db, "s1", "mod", { action: "approved", from: "pending", writeLog: false }));
    await assertFails(review(db, "s1", "mod", { action: "approved", from: "pending", writeStory: false }));
  });

  it("refuses a log entry that doesn't match the review", async () => {
    const db = as("mod");
    const approve = { action: "approved", from: "pending" } as const;
    await assertFails(review(db, "s1", "mod", { ...approve, log: { action: "rejected" } }));
    await assertFails(review(db, "s1", "mod", { ...approve, log: { by: "asha" } }));
    await assertFails(review(db, "s1", "mod", { ...approve, log: { from: "rejected" } }));
    await assertFails(review(db, "s1", "mod", { ...approve, log: { storyId: "a1" } }));
    await assertFails(review(db, "s1", "mod", { ...approve, log: { storeName: "Somewhere else" } }));
    await assertFails(review(db, "s1", "mod", { ...approve, log: { note: NOTE } }));
    await assertFails(review(db, "s1", "mod", { ...approve, log: { at: new Date(2020, 0, 1) } }));
    await assertFails(review(db, "s1", "mod", { ...approve, log: { extra: true } }));
  });

  it("refuses reusing an earlier log entry", async () => {
    const db = as("mod");
    await assertSucceeds(review(db, "s1", "mod", { action: "approved", from: "pending", logId: "L1" }));
    await assertFails(
      review(db, "s1", "mod", { action: "hidden", from: "approved", note: NOTE, logId: "L1" }),
    );
    await assertSucceeds(
      review(db, "s1", "mod", { action: "hidden", from: "approved", note: NOTE, logId: "L2" }),
    );
    // L1 already says "approved" for this story, but it records an earlier decision.
    await assertFails(
      review(db, "s1", "mod", { action: "approved", from: "hidden", logId: "L1", writeLog: false }),
    );
  });

  it("doesn't let a moderator change what the author wrote", async () => {
    const db = as("mod");
    const approve = { action: "approved", from: "pending" } as const;
    await assertFails(review(db, "s1", "mod", { ...approve, story: { caption: "Something else entirely." } }));
    await assertFails(review(db, "s1", "mod", { ...approve, story: { authorId: "mod" } }));
    await assertFails(review(db, "s1", "mod", { ...approve, story: { photoId: "lss/stories/mod/x" } }));
    await assertFails(review(db, "s1", "mod", { ...approve, story: { visibility: "link" } }));
  });

  it("keeps the moderator's identity off the story", async () => {
    await assertFails(
      review(as("mod"), "s1", "mod", { action: "approved", from: "pending", story: { reviewedBy: "mod" } }),
    );
  });

  it("refuses back-dated reviews", async () => {
    const db = as("mod");
    const approve = { action: "approved", from: "pending" } as const;
    await assertFails(review(db, "s1", "mod", { ...approve, story: { reviewedAt: new Date(2020, 0, 1) } }));
    await assertFails(review(db, "s1", "mod", { ...approve, story: { updatedAt: new Date(2020, 0, 1) } }));
  });

  it("doesn't let a moderator delete someone else's story", async () => {
    await assertFails(deleteDoc(doc(as("mod"), "stories/s1")));
  });
});

describe("the moderation log", () => {
  beforeEach(async () => {
    await seed({ s1: story("s1", "pending") });
    await review(as("mod"), "s1", "mod", { action: "approved", from: "pending", logId: "L1" });
  });

  it("can be read only by moderators", async () => {
    await assertSucceeds(getDocs(collection(as("mod"), "moderationLog")));
    await assertFails(getDocs(collection(as("asha"), "moderationLog")));
    await assertFails(getDoc(doc(as("asha"), "moderationLog/L1")));
    await assertFails(getDoc(doc(visitor(), "moderationLog/L1")));
  });

  it("can't be changed or deleted, even by moderators", async () => {
    await assertFails(updateDoc(doc(as("mod"), "moderationLog/L1"), { note: "Changed my mind." }));
    await assertFails(deleteDoc(doc(as("mod"), "moderationLog/L1")));
  });
});

describe("who can read stories", () => {
  beforeEach(() =>
    seed({
      p1: story("p1", "pending"),
      a1: story("a1", "approved"),
      a2: story("a2", "approved", { visibility: "link" }),
      r1: story("r1", "rejected"),
      h1: story("h1", "hidden"),
    }),
  );

  const stories = (db: Firestore) => collection(db, "stories");

  it("lets anyone open an approved story, including one shared by link", async () => {
    for (const db of [visitor(), as("mallory")]) {
      await assertSucceeds(getDoc(doc(db, "stories/a1")));
      await assertSucceeds(getDoc(doc(db, "stories/a2")));
    }
  });

  it("never shows anyone else a story that isn't approved", async () => {
    for (const db of [visitor(), as("mallory")]) {
      for (const id of ["p1", "r1", "h1"]) await assertFails(getDoc(doc(db, "stories", id)));
    }
  });

  it("lists only approved stories shared with everyone", async () => {
    const db = visitor();
    await assertSucceeds(
      getDocs(query(stories(db), where("status", "==", "approved"), where("visibility", "==", "public"))),
    );
    await assertFails(getDocs(query(stories(db), where("status", "==", "approved"))));
    await assertFails(getDocs(query(stories(db), where("visibility", "==", "public"))));
    await assertFails(getDocs(query(stories(as("mallory")), where("status", "==", "pending"))));
    await assertFails(getDocs(stories(as("mallory"))));
  });

  it("still shows authors all their own stories, with the moderator's note", async () => {
    const db = as("asha");
    await assertSucceeds(getDocs(query(stories(db), where("authorId", "==", "asha"))));
    const rejected = await assertSucceeds(getDoc(doc(db, "stories/r1")));
    expect(rejected.data()?.reviewNote).toBe("Please keep it about the store.");
  });

  it("lets moderators see and count every story by status", async () => {
    const db = as("mod");
    for (const id of ["p1", "r1", "h1"]) await assertSucceeds(getDoc(doc(db, "stories", id)));
    await assertSucceeds(getDocs(query(stories(db), where("status", "==", "pending"))));
    const waiting = await assertSucceeds(
      getCountFromServer(query(stories(db), where("status", "==", "pending"))),
    );
    expect(waiting.data().count).toBe(1);
  });
});
