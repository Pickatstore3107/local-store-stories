import { describe, expect, it } from "vitest";
import { dayPart, firstName, greeting, pasGreeting } from "../src/lib/greeting";

describe("greeting", () => {
  it("knows the part of the day", () => {
    expect(dayPart(5)).toBe("morning");
    expect(dayPart(11)).toBe("morning");
    expect(dayPart(12)).toBe("afternoon");
    expect(dayPart(17)).toBe("evening");
    expect(dayPart(21)).toBe("night");
    expect(dayPart(2)).toBe("night");
  });

  it("uses the first name, and none for visitors", () => {
    expect(greeting({ name: "Krishna", hour: 8, seed: 0 })).toBe("Good morning, Krishna");
    expect(greeting({ name: null, hour: 18, seed: 0 })).toBe("Good evening");
    expect(greeting({ name: null, hour: 8, seed: 1 })).toBe("Chai first?");
    expect(greeting({ name: "Asha", hour: 23, seed: 1 })).toBe("Still awake, Asha?");
  });

  it("takes the first word of a name", () => {
    expect(firstName("  Ravi Kumar ")).toBe("Ravi");
    expect(firstName("")).toBeNull();
    expect(firstName(undefined)).toBeNull();
  });

  it("words the redesign's hello as the prototype does", () => {
    expect(pasGreeting("Krishna", 8)).toBe("Chai first, Krishna?");
    expect(pasGreeting("Krishna", 0)).toBe("Chai first, Krishna?");
    expect(pasGreeting(null, 12)).toBe("Lunch break?");
    expect(pasGreeting("Asha", 17)).toBe("Evening walk, Asha?");
    expect(pasGreeting(null, 21)).toBe("Still awake?");
  });
});
