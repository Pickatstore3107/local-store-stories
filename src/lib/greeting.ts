// The hello at the top of Home and on the opening screen: it changes with
// the time of day and uses the member's first name, or the city's for
// visitors.

export type DayPart = "morning" | "afternoon" | "evening" | "night";

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

const HELLOS: Record<DayPart, ((name: string) => string)[]> = {
  morning: [(n) => `Good morning, ${n}`, (n) => `Chai first, ${n}?`],
  afternoon: [(n) => `Good afternoon, ${n}`, (n) => `Lunch break, ${n}?`],
  evening: [(n) => `Good evening, ${n}`, (n) => `Evening walk, ${n}?`],
  night: [(n) => `Up late, ${n}?`, (n) => `Still awake, ${n}?`],
};

/** The first word of a name, for a friendly hello; null if there isn't one. */
export function firstName(full: string | null | undefined): string | null {
  const first = full?.trim().split(/\s+/)[0];
  return first ? first.slice(0, 20) : null;
}

/** The hello for this hour. The seed picks among them, so it stays the same for a visit. */
export function greeting({ name, hour, seed }: { name: string | null; hour: number; seed: number }) {
  const hellos = HELLOS[dayPart(hour)];
  return hellos[seed % hellos.length](name ?? "Hyderabad");
}
