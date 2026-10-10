import { describe, expect, it } from "vitest";
import { dayOf, streakOf } from "../src/lib/streak";

// Times in India (UTC+5:30).
const at = (iso: string) => Date.parse(`${iso}+05:30`);
const today = dayOf(at("2026-10-10T12:00:00"));

describe("streaks", () => {
  it("counts days in a row ending today", () => {
    const posts = [at("2026-10-10T09:00:00"), at("2026-10-09T23:59:00"), at("2026-10-08T00:01:00")];
    expect(streakOf(posts, today)).toEqual({ days: 3, postedToday: true });
  });

  it("is still alive before today's post, ending yesterday", () => {
    expect(streakOf([at("2026-10-09T20:00:00"), at("2026-10-08T20:00:00")], today)).toEqual({ days: 2, postedToday: false });
  });

  it("ends after a whole missed day", () => {
    expect(streakOf([at("2026-10-08T20:00:00"), at("2026-10-07T20:00:00")], today)).toEqual({ days: 0, postedToday: false });
  });

  it("counts several posts on one day once, and uses India's midnight", () => {
    // 18:45 UTC on the 9th is 00:15 on the 10th in India.
    const posts = [Date.parse("2026-10-09T18:45:00Z"), at("2026-10-10T10:00:00"), at("2026-10-09T10:00:00")];
    expect(streakOf(posts, today)).toEqual({ days: 2, postedToday: true });
  });

  it("is 0 with no posts", () => {
    expect(streakOf([], today)).toEqual({ days: 0, postedToday: false });
  });
});
