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
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
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
});

const consent = (overrides: Record<string, unknown> = {}) => ({
  consentVersion: CONSENT_VERSION,
  consentAt: serverTimestamp(),
  ageConfirmed: true,
  ...overrides,
});

const profile = (overrides: Record<string, unknown> = {}) => ({
  displayName: "Asha",
  city: "Pune",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...overrides,
});

// The test library hands back the compat Firestore type; at runtime it works
// with the modular functions the app uses.
type TestDb = ReturnType<RulesTestContext["firestore"]>;

/** The same batched write the welcome screen makes. */
function createAccount(
  testDb: TestDb,
  uid: string,
  p: Record<string, unknown> = profile(),
  c: Record<string, unknown> | null = consent(),
) {
  const db = testDb as unknown as Firestore;
  const batch = writeBatch(db);
  if (c) batch.set(doc(db, "usersPrivate", uid), c);
  batch.set(doc(db, "users", uid), p);
  return batch.commit();
}

/** Writes an existing account directly, bypassing the rules. */
async function seedAccount(uid: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await createAccount(ctx.firestore(), uid);
  });
}

describe("creating an account", () => {
  it("lets a person create their own profile together with consent", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertSucceeds(createAccount(db, "asha"));
  });

  it("refuses a profile without a consent record", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(createAccount(db, "asha", profile(), null));
  });

  it("refuses an account for someone else", async () => {
    const db = env.authenticatedContext("mallory").firestore();
    await assertFails(createAccount(db, "asha"));
  });

  it("refuses visitors who are not signed in", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(createAccount(db, "asha"));
  });

  it("refuses consent without the age confirmation", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(createAccount(db, "asha", profile(), consent({ ageConfirmed: false })));
  });

  it("refuses an outdated consent version", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(createAccount(db, "asha", profile(), consent({ consentVersion: "old" })));
  });

  it("refuses a back-dated consent time", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(
      createAccount(db, "asha", profile(), consent({ consentAt: new Date(2020, 0, 1) })),
    );
  });

  it("refuses fields only the server may set", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(createAccount(db, "asha", profile({ storyCount: 99 })));
    await assertFails(createAccount(db, "asha", profile({ invitedBy: "someone" })));
    await assertFails(createAccount(db, "asha", profile({ role: "admin" })));
    await assertFails(createAccount(db, "asha", profile(), consent({ phone: "+911234567890" })));
  });

  it("refuses names and cities that are empty, too long or not text", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(createAccount(db, "asha", profile({ displayName: "" })));
    await assertFails(createAccount(db, "asha", profile({ displayName: "x".repeat(41) })));
    await assertFails(createAccount(db, "asha", profile({ city: "x" })));
    await assertFails(createAccount(db, "asha", profile({ city: 42 })));
  });
});

describe("reading", () => {
  beforeEach(() => seedAccount("asha"));

  it("lets anyone read a single public profile", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "users/asha")));
  });

  it("does not let anyone list every profile", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(getDocs(collection(db, "users")));
  });

  it("lets only the owner read their consent record", async () => {
    const own = env.authenticatedContext("asha").firestore();
    await assertSucceeds(getDoc(doc(own, "usersPrivate/asha")));
    await assertFails(getDocs(collection(own, "usersPrivate")));

    const other = env.authenticatedContext("mallory").firestore();
    await assertFails(getDoc(doc(other, "usersPrivate/asha")));

    const visitor = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(visitor, "usersPrivate/asha")));
  });
});

describe("editing a profile", () => {
  beforeEach(() => seedAccount("asha"));

  it("lets the owner change their name and city", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertSucceeds(
      updateDoc(doc(db, "users/asha"), {
        displayName: "Asha K.",
        city: "Mumbai",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("refuses edits from anyone else", async () => {
    const db = env.authenticatedContext("mallory").firestore();
    await assertFails(
      updateDoc(doc(db, "users/asha"), { displayName: "Hacked", updatedAt: serverTimestamp() }),
    );
  });

  it("refuses changes to the creation time or new fields", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(
      updateDoc(doc(db, "users/asha"), {
        createdAt: new Date(2020, 0, 1),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, "users/asha"), { storyCount: 5, updatedAt: serverTimestamp() }),
    );
  });

  it("refuses an edit without a fresh update time", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(updateDoc(doc(db, "users/asha"), { displayName: "Asha K." }));
  });

  it("refuses an edit that breaks the length limits", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(
      updateDoc(doc(db, "users/asha"), { displayName: "", updatedAt: serverTimestamp() }),
    );
  });
});

describe("deleting an account", () => {
  beforeEach(() => seedAccount("asha"));

  it("lets the owner delete their profile and consent record", async () => {
    const db = env.authenticatedContext("asha").firestore();
    const batch = writeBatch(db);
    batch.delete(doc(db, "users/asha"));
    batch.delete(doc(db, "usersPrivate/asha"));
    await assertSucceeds(batch.commit());
  });

  it("refuses deletes from anyone else", async () => {
    const db = env.authenticatedContext("mallory").firestore();
    await assertFails(deleteDoc(doc(db, "users/asha")));
    await assertFails(deleteDoc(doc(db, "usersPrivate/asha")));
  });
});

describe("everything else stays locked", () => {
  it("denies other collections and sub-collections", async () => {
    const db = env.authenticatedContext("asha").firestore();
    await assertFails(setDoc(doc(db, "stories/one"), { caption: "hi" }));
    await assertFails(getDoc(doc(db, "stories/one")));
    await assertFails(setDoc(doc(db, "users/asha/secret/x"), { a: 1 }));
  });
});
