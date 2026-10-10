import Image from "next/image";

/**
 * The top of Home: a poster of Hyderabad, then what the site is about in
 * one line.
 */
export function HomeHero() {
  return (
    <section aria-labelledby="home-title" className="pt-1 sm:pt-4">
      <Image
        src="/art/hyderabad-poster.jpg"
        alt="Poster: HYDERABAD in tall letters over the Charminar, with the city's name in Telugu."
        width={735}
        height={600}
        priority
        sizes="(min-width: 640px) 36rem, 100vw"
        className="w-full rounded-[1.3rem] bg-sand lift-sm"
      />
      <h1
        id="home-title"
        className="mt-3 text-[1.35rem] font-extrabold leading-tight tracking-tight text-ink sm:text-[1.9rem]"
      >
        Discover local places{" "}
        <span className="whitespace-nowrap font-hand font-bold tracking-normal text-brand-red">and their stories</span>
      </h1>
    </section>
  );
}
