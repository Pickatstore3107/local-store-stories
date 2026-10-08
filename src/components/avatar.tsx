import { initial } from "@/lib/people";

const sizes = {
  sm: "h-11 w-11 text-lg",
  lg: "h-24 w-24 text-4xl ring-4 ring-brand-yellow/70 sm:h-28 sm:w-28 sm:text-5xl",
};

/** A circle with the first letter of someone's name, instead of a photo. */
export function Avatar({ name, size = "sm" }: { name: string; size?: keyof typeof sizes }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-red font-extrabold text-white ${sizes[size]}`}
    >
      {initial(name)}
    </span>
  );
}
