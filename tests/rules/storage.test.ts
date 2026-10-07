import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { startRulesEnv } from "./setup";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await startRulesEnv();
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearStorage();
});

const jpeg = { contentType: "image/jpeg" };
const bytes = (size: number) => new Uint8Array(size);
const photoPath = "uploads/asha/s1/photo.jpg";

function upload(uid: string | null, path: string, size = 1000, metadata = jpeg) {
  const ctx = uid ? env.authenticatedContext(uid) : env.unauthenticatedContext();
  return uploadBytes(ref(ctx.storage(), path), bytes(size), metadata);
}

describe("uploading story photos", () => {
  it("lets people upload a photo and thumbnail to their own folder", async () => {
    await assertSucceeds(upload("asha", photoPath));
    await assertSucceeds(upload("asha", "uploads/asha/s1/thumb.jpg"));
  });

  it("refuses uploads to someone else's folder or by visitors", async () => {
    await assertFails(upload("mallory", photoPath));
    await assertFails(upload(null, photoPath));
  });

  it("refuses other file names and types", async () => {
    await assertFails(upload("asha", "uploads/asha/s1/script.js"));
    await assertFails(upload("asha", photoPath, 1000, { contentType: "image/png" }));
    await assertFails(upload("asha", photoPath, 1000, { contentType: "text/html" }));
  });

  it("refuses files over the size limits", async () => {
    await assertFails(upload("asha", photoPath, 5 * 1024 * 1024 + 1));
    await assertFails(upload("asha", "uploads/asha/s1/thumb.jpg", 512 * 1024 + 1));
  });

  it("denies everything outside the uploads folder", async () => {
    await assertFails(upload("asha", "public/asha/photo.jpg"));
    await assertFails(upload("asha", "uploads/asha/photo.jpg"));
  });
});

describe("reading and deleting story photos", () => {
  beforeEach(() => upload("asha", photoPath));

  it("lets only the owner see their photo before review", async () => {
    await assertSucceeds(getBytes(ref(env.authenticatedContext("asha").storage(), photoPath)));
    await assertFails(getBytes(ref(env.authenticatedContext("mallory").storage(), photoPath)));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), photoPath)));
  });

  it("lets only the owner delete it", async () => {
    await assertFails(deleteObject(ref(env.authenticatedContext("mallory").storage(), photoPath)));
    await assertSucceeds(deleteObject(ref(env.authenticatedContext("asha").storage(), photoPath)));
  });
});
