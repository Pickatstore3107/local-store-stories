"use client";

import Image from "next/image";
import { useGreeting, Words } from "../greeting";

/**
 * The hello at the top of Home, with the time of day and the member's
 * first name, words coming into focus one by one. Holds its place while
 * it waits, so nothing below jumps.
 */
export function HeroGreeting() {
  const greeting = useGreeting();
  return (
    <p className="flex min-h-[1.6rem] items-center gap-1.5 font-serif text-[1.12rem] italic text-ink sm:text-[1.25rem]">
      {greeting && (
        <>
          <Image
            src="/brand/pas-emblem.png"
            alt=""
            width={64}
            height={64}
            className="anim-pop h-[1.35rem] w-[1.35rem] shrink-0 rounded-[0.4rem]"
          />
          <span>
            <Words text={greeting} delay={1} />
          </span>
        </>
      )}
    </p>
  );
}
