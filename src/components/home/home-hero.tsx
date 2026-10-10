import Image from "next/image";

/**
 * The top of Home: what the site is about in a few words, next to a small
 * poster of Hyderabad.
 */
export function HomeHero() {
  return (
    <section aria-labelledby="home-title" className="flex items-center gap-3 pt-1 sm:gap-6 sm:pt-4">
      <div className="min-w-0 flex-1">
        <h1
          id="home-title"
          className="text-[1.75rem] leading-[1.08] text-ink sm:text-[2.6rem]"
        >
          Discover local places{" "}
          <span className="block font-serif italic text-brand-red">and their stories</span>
        </h1>
        <p className="mt-1.5 text-[0.9rem] leading-snug text-ink-soft sm:mt-3 sm:text-base">
          Shops, stalls and landmarks, remembered by the people of Hyderabad.
        </p>
      </div>
      <Image
        src="/art/hyderabad-poster.jpg"
        alt="Poster: HYDERABAD in tall letters over the Charminar, with the city's name in Telugu."
        width={735}
        height={913}
        priority
        sizes="(min-width: 640px) 10rem, 7rem"
        className="w-[6.6rem] shrink-0 rotate-2 rounded-xl bg-sand shadow-[0_6px_16px_rgb(90_50_20/0.18)] ring-[3px] ring-white sm:w-40"
      />
    </section>
  );
}
