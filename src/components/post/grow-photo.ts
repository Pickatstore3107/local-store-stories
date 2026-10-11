"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, type MouseEvent, type RefObject } from "react";

/**
 * A post's photo grows out of whatever photo was tapped to open it (a
 * cover or a colour card on Home), and shrinks back into it when the post
 * is closed. The tapped photo and the post's photo share a name only for
 * that moment, so the browser moves one into the other.
 *
 * Photos that can open a post carry data-photo-of (the post) and
 * data-photo-from (where on the page it is).
 */
const NAME = "post-photo";
const SETTLE_MS = 700;

type Opening = { id: string; from: string; photo: string | null };
let opening: Opening | null = null;
const named = new Set<HTMLElement>();

function name(el: HTMLElement) {
  el.style.viewTransitionName = NAME;
  named.add(el);
}

/** Takes the shared name off again once the move is over. */
function unnameSoon() {
  setTimeout(() => {
    for (const el of named) el.style.viewTransitionName = "";
    named.clear();
  }, SETTLE_MS);
}

function canMove() {
  return "startViewTransition" in document && !matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function onScreen(el: HTMLElement) {
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.bottom > 0 && box.top < innerHeight;
}

/** The photo on the page that opened this post, if it's still there. */
function photoOf(id: string, from: string | null) {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-photo-of="${CSS.escape(id)}"]`)).filter(
    (el) => el.offsetParent !== null && !el.closest("[inert]"),
  );
  return all.find((el) => el.dataset.photoFrom === from) ?? all[0] ?? null;
}

/** On the link's click: remember which photo was tapped and name it. */
export function openingFrom(event: MouseEvent, id: string, from: string, photo: string | null) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
  opening = { id, from, photo };
  if (!canMove()) return;
  const el = photoOf(id, from);
  if (el && onScreen(el)) name(el);
}

/** Whether this post was opened from a photo on this site. */
export function openedHere(id: string) {
  return opening?.id === id;
}

/** The photo that was tapped to open this post. */
export function openingPhoto(id: string) {
  return opening?.id === id ? opening.photo : null;
}

/** On the post's page: its photo takes the shared name as it arrives. */
export function useGrowInto(ref: RefObject<HTMLElement | null>, id: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || opening?.id !== id || !named.size) return;
    name(el);
    unnameSoon();
  }, [ref, id]);
}

/**
 * "Back" on a post's page: if it was opened from a photo on this site, go
 * back there and shrink the photo into it; otherwise go to Home.
 */
export function useClosePost(id: string) {
  const router = useRouter();
  return (event: MouseEvent) => {
    if (opening?.id !== id) return; // the link goes Home
    event.preventDefault();
    const { from } = opening;
    const post = document.querySelector<HTMLElement>(`[data-post-photo="${CSS.escape(id)}"]`);
    if (!canMove() || !post || !onScreen(post)) {
      router.back();
      return;
    }
    name(post);
    const move = document.startViewTransition(async () => {
      post.style.viewTransitionName = "";
      const leaving = location.pathname;
      router.back();
      const back = await until(() => location.pathname !== leaving && photoOf(id, from));
      if (!back) return;
      // Let the page finish putting its scroll back, then make sure the photo is in view.
      await tick();
      if (!onScreen(back)) back.scrollIntoView({ block: "center" });
      name(back);
    });
    move.finished.finally(() => {
      for (const el of named) el.style.viewTransitionName = "";
      named.clear();
      opening = null;
    });
  };
}

// Animation frames are held back while the page is changing, so waits use timers.
const tick = () => new Promise((done) => setTimeout(done, 16));

/** Waits for check() to give something, checking every few milliseconds, for up to 0.6 s. */
async function until<T>(check: () => T | null | false): Promise<T | null> {
  const end = performance.now() + 600;
  while (performance.now() < end) {
    const found = check();
    if (found) return found;
    await tick();
  }
  return null;
}
