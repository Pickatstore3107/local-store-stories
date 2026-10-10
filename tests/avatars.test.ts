import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

// The links a profile keeps for its photo must pass photoLink() in firestore.rules.
const rule = readFileSync("firestore.rules", "utf8").match(/url\.matches\('([^']+)' \+ id \+ '([^']+)'\)/)!;
const accepts = (url: string, id: string) => new RegExp(`^${rule[1]}${id}${rule[2]}$`).test(url);

beforeAll(() => {
  process.env.CLOUDINARY_CLOUD_NAME = "lsstest";
  process.env.CLOUDINARY_API_KEY = "111";
  process.env.CLOUDINARY_API_SECRET = "test-only-secret";
});

describe("profile photo links", () => {
  it("are signed links the security rules accept", async () => {
    const { avatarPhoto, newAvatarId } = await import("../src/lib/server/avatars");
    const id = newAvatarId("ravi123");
    expect(id).toMatch(/^lss\/avatars\/ravi123\/[A-Za-z0-9]{20}$/);
    const photo = avatarPhoto(id);
    expect(photo.id).toBe(id);
    expect(photo.small).toContain("/image/authenticated/s--");
    expect(photo.small).toContain("w_96");
    expect(photo.large).toContain("w_320");
    expect(accepts(photo.small, id)).toBe(true);
    expect(accepts(photo.large, id)).toBe(true);
    expect(accepts(photo.large, newAvatarId("ravi123"))).toBe(false);
  });

  it("are only made for profile photo IDs", async () => {
    const { avatarPhoto } = await import("../src/lib/server/avatars");
    expect(() => avatarPhoto("lss/stories/ravi123/AbCdEfGhIjKlMnOpQrSt")).toThrow();
    expect(() => avatarPhoto("lss/avatars/ravi123/../x")).toThrow();
  });
});
