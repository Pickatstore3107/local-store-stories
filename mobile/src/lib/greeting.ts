// A copy of the website's src/lib/greeting.ts, changed only where a phone differs.
// The hello at the top of Home and on the opening screen: it changes with
// the time of day and uses the member's first name; visitors get it
// without a name.

export type DayPart = "morning" | "afternoon" | "evening" | "night";

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

// Each hello as [start, end]: the name goes between them, after a comma.
const HELLOS: Record<DayPart, [string, string][]> = {
  morning: [["Good morning", ""], ["Chai first", "?"]],
  afternoon: [["Good afternoon", ""], ["Lunch break", "?"]],
  evening: [["Good evening", ""], ["Evening walk", "?"]],
  night: [["Up late", "?"], ["Still awake", "?"]],
};

/** The first word of a name, for a friendly hello; null if there isn't one. */
export function firstName(full: string | null | undefined): string | null {
  const first = full?.trim().split(/\s+/)[0];
  return first ? first.slice(0, 20) : null;
}

/** The hello for this hour. The seed picks among them, so it stays the same for a visit. */
export function greeting({ name, hour, seed }: { name: string | null; hour: number; seed: number }) {
  const hellos = HELLOS[dayPart(hour)];
  const [start, end] = hellos[seed % hellos.length];
  return name ? `${start}, ${name}${end}` : `${start}${end}`;
}

/**
 * The redesign's hello, as the prototype words it: one per part of the
 * day, with the member's first name before the question mark.
 */
export function pasGreeting(name: string | null, hour: number) {
  const hello = hour < 12 ? "Chai first" : hour < 17 ? "Lunch break" : hour < 21 ? "Evening walk" : "Still awake";
  return name ? hello + ", " + name + "?" : hello + "?";
}
