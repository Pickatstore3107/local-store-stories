import { assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { getBytes, ref, uploadString } from "firebase/storage";
import { afterAll, beforeAll, describe, it } from "vitest";
import { startRulesEnv } from "./setup";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await startRulesEnv();
});
afterAll(async () => {
  await env?.cleanup();
});

// Firebase Storage is not used; nothing gets in or out.
describe("Storage stays locked", () => {
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
