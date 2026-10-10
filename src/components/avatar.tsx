import { initial } from "@/lib/people";

const sizes = {
  // The phone's bottom bar is sized in pixels, so it's the same on every phone.
  bar: "h-[22px] w-[22px] text-[11px]",
  xxs: "h-6 w-6 text-xs",
  xs: "h-9 w-9 text-base",
  sm: "h-11 w-11 text-lg",
  lg: "h-20 w-20 text-3xl ring-4 ring-brand-yellow/70 sm:h-28 sm:w-28 sm:text-5xl",
};

/**
 * Someone's profile photo, once a moderator has approved it, or a circle
 * with the first letter of their name. The letter stays underneath, so it
 * shows while the photo loads, or if it can't.
 */
export function Avatar({
  name,
  photo = null,
  size = "sm",
}: {
  name: string;
  /** A link to the photo: the small one, or the large one for `lg`. */
  photo?: string | null;
  size?: keyof typeof sizes;
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-red font-extrabold text-white ${sizes[size]}`}
    >
      {initial(name)}
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
        <img
          src={photo}
          alt=""
          width={size === "lg" ? 320 : 96}
          height={size === "lg" ? 320 : 96}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}
