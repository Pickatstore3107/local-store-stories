import Image from "next/image";
import { RollingWord } from "./rolling-word";

/**
 * The top of Home: what the site is about in a few words, the kind of
 * place changing as you look, next to a small poster of Hyderabad.
 */
export function HomeHero() {
  return (
    <section aria-labelledby="home-title" className="flex items-center gap-3 pt-1 sm:gap-6 sm:pt-4">
      <div className="min-w-0 flex-1">
        <h1 id="home-title" className="text-[1.75rem] leading-[1.08] text-ink sm:text-[2.6rem]">
          <span className="sr-only">Discover local places and their stories</span>
          <span aria-hidden="true">
            <span className="anim-up block">Discover local</span>
            <span className="anim-up relative block font-serif italic text-brand-red [--i:1]">
              <span className="relative isolate inline-block">
                <span
                  className="anim-underline absolute inset-x-[-0.1em] bottom-[0.06em] -z-10 h-[0.36em] -rotate-1 rounded-sm bg-brand-yellow/80"
                />
                <RollingWord />
              </span>
            </span>
            <span className="anim-up block text-[0.62em] font-semibold leading-tight text-ink [--i:2]">
              and the stories behind them
            </span>
          </span>
        </h1>
        <p className="anim-up mt-1.5 text-[0.9rem] leading-snug text-ink-soft [--i:3] sm:mt-3 sm:text-base">
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
        className="anim-sway w-[6.6rem] shrink-0 rotate-2 rounded-xl bg-sand shadow-[0_6px_16px_rgb(90_50_20/0.18)] ring-[3px] ring-white sm:w-40"
      />
    </section>
  );
}
