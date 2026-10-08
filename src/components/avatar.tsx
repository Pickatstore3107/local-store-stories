import { initial } from "@/lib/people";

const sizes = {
  xxs: "h-6 w-6 text-xs",
  xs: "h-9 w-9 text-base",
  sm: "h-11 w-11 text-lg",
  lg: "h-16 w-16 text-3xl ring-4 ring-brand-yellow sm:h-28 sm:w-28 sm:text-6xl",
};

/** A circle with the first letter of someone's name, instead of a photo. */
export function Avatar({ name, size = "sm" }: { name: string; size?: keyof typeof sizes }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-ink bg-teal pt-[0.1em] font-display leading-none text-cream ${sizes[size]}`}
    >
      {initial(name)}
    </span>
  );
}
