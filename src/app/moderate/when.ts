import type { Timestamp } from "firebase/firestore";

const format = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "7 Oct 2026, 1:16 pm", from a timestamp or milliseconds. */
export function when(time: Timestamp | number | undefined) {
  if (typeof time === "number") return time ? format.format(new Date(time)) : "";
  return time ? format.format(time.toDate()) : "";
}
