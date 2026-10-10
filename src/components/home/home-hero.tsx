/**
 * The top of Home, in the style of an old city poster: HYDERABAD in tall
 * tan letters across the page with its Telugu name under it, what the site
 * is about, and our own drawing of the Charminar as a sticker, stepping out
 * of a yellow arch in front of the letters.
 */
export function HomeHero() {
  return (
    <section aria-labelledby="home-title" className="relative isolate pt-2 sm:pt-5">
      {/* Stretched to the full width, whatever the phone. */}
      <svg aria-hidden="true" viewBox="0 0 400 81" className="block w-full select-none">
        <text
          x="0"
          y="80.5"
          textLength="400"
          lengthAdjust="spacingAndGlyphs"
          className="fill-tan font-poster text-[93.7px]"
        >
          HYDERABAD
        </text>
      </svg>

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 pt-1.5">
          <p aria-hidden="true" lang="te" className="font-telugu text-[0.95rem] font-semibold leading-none text-[#8b6440] sm:text-lg">
            హైదరాబాద్
          </p>
          <h1
            id="home-title"
            className="mt-2 text-[1.75rem] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-[2.5rem]"
          >
            <span className="block">Discover</span>
            <span className="block">local places</span>
            <span className="mt-0.5 block whitespace-nowrap font-hand text-[1.6rem] font-bold leading-none tracking-normal text-brand-red sm:text-[2.3rem]">
              and their{" "}
              <span className="relative inline-block">
                stories
                <svg
                  viewBox="0 0 120 14"
                  aria-hidden="true"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1 -left-1 -z-10 h-[0.28em] w-[106%]"
                >
                  <path d="M3 10C30 3 72 1 117 6" stroke="var(--brand-yellow)" strokeWidth="7" strokeLinecap="round" fill="none" />
                </svg>
              </span>
            </span>
          </h1>
          <p className="mt-2.5 text-[0.86rem] leading-snug text-ink-soft sm:text-base">
            Shops, stalls and landmarks, remembered by the people of your city.
          </p>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none relative -mt-[2.9rem] h-[11.4rem] w-[8.4rem] shrink-0 select-none sm:-mt-[4.2rem] sm:h-[16rem] sm:w-[12rem]"
        >
          <span className="absolute inset-x-0 bottom-0 h-[7.6rem] rounded-b-[1.1rem] rounded-t-full bg-brand-yellow sm:h-[10.6rem]" />
          {/* eslint-disable-next-line @next/next/no-img-element -- a small drawing that never changes */}
          <img
            src="/art/charminar.svg"
            alt=""
            width={220}
            height={356}
            className="sticker absolute bottom-1.5 left-1/2 h-[11rem] w-auto -translate-x-1/2 sm:h-[15.4rem]"
          />
          <span className="sticker absolute -left-2 bottom-3 -rotate-[7deg] rounded-md bg-brand-red px-1.5 py-1 text-[0.62rem] font-extrabold uppercase leading-none tracking-[0.08em] text-white sm:text-xs">
            Since 1591
          </span>
        </div>
      </div>
    </section>
  );
}
