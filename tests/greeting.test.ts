import { describe, expect, it } from "vitest";
import { dayPart, firstName, greeting, LINES } from "../src/lib/greeting";

describe("greeting", () => {
  it("knows the part of the day", () => {
    expect(dayPart(5)).toBe("morning");
    expect(dayPart(11)).toBe("morning");
    expect(dayPart(12)).toBe("afternoon");
    expect(dayPart(17)).toBe("evening");
    expect(dayPart(21)).toBe("night");
    expect(dayPart(2)).toBe("night");
  });

  it("uses the first name, or the city for visitors", () => {
    expect(greeting({ name: "Krishna", hour: 8, seed: 0 }).hello).toBe("Good morning, Krishna");
    expect(greeting({ name: null, hour: 18, seed: 0 }).hello).toBe("Good evening, Hyderabad");
    expect(greeting({ name: "Asha", hour: 23, seed: 1 }).hello).toBe("Still awake, Asha?");
  });

  it("takes the first word of a name", () => {
    expect(firstName("  Ravi Kumar ")).toBe("Ravi");
    expect(firstName("")).toBeNull();
    expect(firstName(undefined)).toBeNull();
  });

  it("shows every line once, starting from the seed", () => {
    const { lines } = greeting({ name: null, hour: 9, seed: 3 });
    expect(lines[0]).toBe(LINES[3]);
    expect(new Set(lines).size).toBe(LINES.length);
  });
});
