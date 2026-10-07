import { readFileSync } from "node:fs";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getBytes, ref, uploadString } from "firebase/storage";
import { afterAll, beforeAll, describe, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-local-store-stories",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe("Firestore starts locked", () => {
  it("denies reads and writes to visitors", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "stories/any")));
    await assertFails(setDoc(doc(db, "stories/any"), { caption: "hi" }));
  });

  it("denies reads and writes to signed-in people", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(db, "users/alice")));
    await assertFails(setDoc(doc(db, "users/alice"), { name: "Alice" }));
  });
});

describe("Storage starts locked", () => {
  it("denies uploads and downloads to visitors", async () => {
    const storage = env.unauthenticatedContext().storage();
    await assertFails(uploadString(ref(storage, "uploads/x.txt"), "hi"));
    await assertFails(getBytes(ref(storage, "uploads/x.txt")));
  });

  it("denies uploads to signed-in people", async () => {
    const storage = env.authenticatedContext("alice").storage();
    await assertFails(uploadString(ref(storage, "uploads/alice/x.txt"), "hi"));
  });
});
