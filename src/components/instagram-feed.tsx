"use client";

import { useEffect, useRef, useState } from "react";
import { setCookieChoice, useCookieChoice } from "./cookie-choice";

// Instagram posts picked in Curator (curator.io), which shows them with its
// own script. The free plan counts every page that loads the feed, up to
// 2,000 a month, so it only loads when someone scrolls down to it, and only
// for visitors who allowed its cookies.
const FEED_ID = "314252f1-dbe9-48fd-978d-a49baf5adda2";
const CONTAINER_ID = "curator-feed-default-feed-layout";

/**
 * "From Instagram" at the bottom of Home. Curator draws into an element of
 * its own, which React never touches, so the two don't trip over each other.
 */
export function InstagramFeed() {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const choice = useCookieChoice();
  const allowed = choice === "all";

  useEffect(() => {
    const element = box.current!;
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        watcher.disconnect();
      },
      { rootMargin: "300px 0px" },
    );
    watcher.observe(element);
    return () => watcher.disconnect();
  }, []);

  useEffect(() => {
    if (!near || !allowed) return;
    const feed = document.createElement("div");
    feed.id = CONTAINER_ID;
    const credit = document.createElement("a");
    credit.href = "https://curator.io";
    credit.target = "_blank";
    credit.rel = "noopener";
    credit.className = "crt-logo crt-tag";
    credit.textContent = "Powered by Curator.io";
    feed.append(credit);
    box.current!.append(feed);

    // Curator draws a new feed each time its script runs, so it runs once
    // per box: a box that's taken away straight after it's made (as React
    // does while developing) never gets one.
    const script = document.createElement("script");
    script.async = true;
    script.charset = "UTF-8";
    script.src = `https://cdn.curator.io/published/${FEED_ID}.js`;
    const start = setTimeout(() => document.body.append(script));
    return () => {
      clearTimeout(start);
      script.remove();
      feed.remove();
    };
  }, [near, allowed]);

  return (
    <section aria-labelledby="instagram-heading" className="mt-10 sm:mt-16">
      <h2 id="instagram-heading" className="text-lg font-extrabold text-ink sm:text-xl">
        From Instagram
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Public posts about local stores, straight from Instagram.
      </p>
      {(choice === "essential" || choice === null) && (
        <div className="mt-4 rounded-3xl bg-white p-5 text-sm text-ink-soft lift-sm">
          <p>
            These posts come from Curator and Instagram, which may set their own cookies, so they
            load only if you allow them.
          </p>
          <button
            type="button"
            onClick={() => setCookieChoice("all")}
            className="mt-3 rounded-full bg-white px-4 py-2 font-bold text-ink ring-1 ring-ink/20 transition hover:bg-sand/60"
          >
            Show Instagram posts
          </button>
        </div>
      )}
      <div ref={box} className={allowed ? "mt-4 min-h-40" : undefined} />
    </section>
  );
}
