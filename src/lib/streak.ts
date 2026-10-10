// A streak is how many days in a row someone has shared a post with
// everyone, like Snapchat's. A day runs midnight to midnight in India.
// Missing a whole day ends it; today still counts as kept until midnight.

const INDIA = 5.5 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

/** Which day a moment falls on in India, as a whole number. */
export const dayOf = (ms: number) => Math.floor((ms + INDIA) / DAY);

export type Streak = {
  /** Days in a row, ending today or yesterday; 0 when it has ended. */
  days: number;
  /** Whether today already has a post, so the streak is safe until midnight. */
  postedToday: boolean;
};

/** The streak from the times posts were shared, on the given day. */
export function streakOf(sharedAt: number[], today: number): Streak {
  const days = new Set(sharedAt.filter((at) => at > 0).map(dayOf));
  const postedToday = days.has(today);
  let day = postedToday ? today : today - 1;
  let count = 0;
  while (days.has(day)) {
    count++;
    day--;
  }
  return { days: count, postedToday };
}
