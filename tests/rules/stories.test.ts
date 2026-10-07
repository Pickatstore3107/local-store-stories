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
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { CONSENT_VERSION, startRulesEnv } from "./setup";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await startRulesEnv();
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    for (const uid of ["asha", "mallory"]) {
      await setDoc(doc(db, "usersPrivate", uid), {
        consentVersion: CONSENT_VERSION,
        consentAt: new Date(),
        ageConfirmed: true,
      });
    }
  });
});

type TestDb = ReturnType<RulesTestContext["firestore"]>;
const asDb = (testDb: TestDb) => testDb as unknown as Firestore;

const story = (uid: string, id: string, overrides: Record<string, unknown> = {}) => ({
  authorId: uid,
  storeName: "Sharma Tea Stall",
  category: "Tea Stalls",
  city: "Pune",
  neighbourhood: "Kothrud",
  caption: "Cutting chai after every exam, with my best friends.",
  year: 2004,
  ordered: "Cutting chai and bun maska",
  visibility: "public",
  rightsConfirmed: true,
  status: "pending",
  photoId: `lss/stories/${uid}/${id}`,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...overrides,
});

function share(testDb: TestDb, uid: string, id: string, overrides = {}) {
  return setDoc(doc(asDb(testDb), "stories", id), story(uid, id, overrides));
}

async function seedStory(uid: string, id: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await share(ctx.firestore(), uid, id);
  });
}

describe("sharing a story", () => {
  it("lets a person who gave consent share a pending story", async () => {
    await assertSucceeds(share(env.authenticatedContext("asha").firestore(), "asha", "s1"));
  });

  it("accepts a story without the optional details", async () => {
    const db = env.authenticatedContext("asha").firestore();
    const required: Record<string, unknown> = story("asha", "s1");
    for (const key of ["neighbourhood", "year", "ordered"]) delete required[key];
    await assertSucceeds(setDoc(doc(asDb(db), "stories", "s1"), required));
  });

  it("refuses people who have not given consent", async () => {
    const db = env.authenticatedContext("newcomer").firestore();
    await assertFails(share(db, "newcomer", "s1"));
  });

  it("refuses visitors who are not signed in", async () => {
    await assertFails(share(env.unauthenticatedContext().firestore(), "asha", "s1"));
  });

  it("refuses a story written in someone else's name", async () => {
    const db = env.authenticatedContext("mallory").firestore();
    await assertFails(share(db, "asha", "s1"));
    await assertFails(share(db, "mallory", "s1", { authorId: "asha" }));
  });

  it("refuses a story that approves itself", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(share(db, "asha", "s1", { status: "approved" }));
  });

  it("refuses a photo that belongs to someone else or another story", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(share(db, "asha", "s1", { photoId: "lss/stories/mallory/s1" }));
    await assertFails(share(db, "asha", "s1", { photoId: "lss/stories/asha/s2" }));
  });

  it("refuses unknown categories, visibility and extra fields", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(share(db, "asha", "s1", { category: "Casinos" }));
    await assertFails(share(db, "asha", "s1", { visibility: "everyone" }));
    await assertFails(share(db, "asha", "s1", { featured: true }));
    await assertFails(share(db, "asha", "s1", { invitedBy: "someone" }));
  });

  it("refuses text that is too short, too long or not text", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(share(db, "asha", "s1", { caption: "short" }));
    await assertFails(share(db, "asha", "s1", { caption: "x".repeat(1001) }));
    await assertFails(share(db, "asha", "s1", { storeName: "x" }));
    await assertFails(share(db, "asha", "s1", { city: 42 }));
    await assertFails(share(db, "asha", "s1", { ordered: "" }));
  });

  it("refuses years in the future or before 1940", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(share(db, "asha", "s1", { year: new Date().getFullYear() + 1 }));
    await assertFails(share(db, "asha", "s1", { year: 1900 }));
    await assertFails(share(db, "asha", "s1", { year: "2004" }));
  });

  it("refuses a story without the photo permission confirmed", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(share(db, "asha", "s1", { rightsConfirmed: false }));
  });

  it("refuses back-dated stories", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(share(db, "asha", "s1", { createdAt: new Date(2020, 0, 1) }));
  });
});

describe("reading stories before review", () => {
  beforeEach(() => seedStory("asha", "s1"));

  it("lets the author read and list their own stories", async () => {
    const db = asDb(env.authenticatedContext("asha").firestore());
    await assertSucceeds(getDoc(doc(db, "stories/s1")));
    await assertSucceeds(getDocs(query(collection(db, "stories"), where("authorId", "==", "asha"))));
  });

  it("hides pending stories from everyone else", async () => {
    const other = asDb(env.authenticatedContext("mallory").firestore());
    await assertFails(getDoc(doc(other, "stories/s1")));
    await assertFails(getDocs(collection(other, "stories")));
    await assertFails(getDocs(query(collection(other, "stories"), where("authorId", "==", "asha"))));

    const visitor = asDb(env.unauthenticatedContext().firestore());
    await assertFails(getDoc(doc(visitor, "stories/s1")));
  });
});

describe("changing and deleting stories", () => {
  beforeEach(() => seedStory("asha", "s1"));

  it("does not let anyone edit a story or change its status yet", async () => {
    const db = asDb(env.authenticatedContext("asha").firestore());
    await assertFails(updateDoc(doc(db, "stories/s1"), { status: "approved" }));
    await assertFails(updateDoc(doc(db, "stories/s1"), { caption: "A different memory now." }));
  });

  it("lets only the author delete it", async () => {
    const other = asDb(env.authenticatedContext("mallory").firestore());
    await assertFails(deleteDoc(doc(other, "stories/s1")));
    const own = asDb(env.authenticatedContext("asha").firestore());
    await assertSucceeds(deleteDoc(doc(own, "stories/s1")));
  });
});
