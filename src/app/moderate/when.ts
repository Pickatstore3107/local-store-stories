import type { Timestamp } from "firebase/firestore";

const format = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "7 Oct 2026, 1:16 pm" */
export function when(time: Timestamp | undefined) {
  return time ? format.format(time.toDate()) : "";
}
