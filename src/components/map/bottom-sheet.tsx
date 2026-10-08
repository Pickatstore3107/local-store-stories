"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";

export type SheetAt = "peek" | "half" | "full";
export type SheetHeights = Record<SheetAt, number>;

const ORDER: SheetAt[] = ["peek", "half", "full"];

/**
 * The list over the bottom of the map on a phone, dragged up for more, like
 * Google Maps. On a computer it's a panel at the side, always open (no
 * heights).
 */
export function BottomSheet({
  at,
  onAt,
  heights,
  onDrag,
  label,
  header,
  children,
}: {
  at: SheetAt;
  onAt: (at: SheetAt) => void;
  heights: SheetHeights | null;
  /** How tall it is while a finger is moving it, then null. */
  onDrag?: (height: number | null) => void;
  label: string;
  header: ReactNode;
  children: ReactNode;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const dragged = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  // The finger (or mouse) is followed on the whole window, since one quick
  // flick leaves the handle before the first move arrives.
  function down(event: PointerEvent<HTMLDivElement>) {
    dragged.current = false;
    if (!heights || event.button !== 0) return;
    stop.current?.();
    const limits = heights;
    const g = {
      y: event.clientY,
      height: limits[at],
      now: limits[at],
      moved: false,
      lastY: event.clientY,
      lastT: event.timeStamp,
      speed: 0,
    };

    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      const up = g.y - e.clientY;
      if (!g.moved) {
        if (Math.abs(up) < 6) return;
        g.moved = true;
      }
      const dt = Math.max(1, e.timeStamp - g.lastT);
      g.speed = (g.lastY - e.clientY) / dt;
      g.lastY = e.clientY;
      g.lastT = e.timeStamp;
      g.now = Math.min(
        limits.full,
        Math.max(limits.peek * 0.75, g.height + up),
      );
      setDrag(g.now);
      onDrag?.(g.now);
    };
    const end = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      off();
      if (!g.moved) return;
      dragged.current = true;
      // Where it would come to rest if let go at this speed.
      const aim = g.now + g.speed * 220;
      const next = ORDER.reduce((best, each) =>
        Math.abs(limits[each] - aim) < Math.abs(limits[best] - aim)
          ? each
          : best,
      );
      setDrag(null);
      onDrag?.(null);
      onAt(next);
    };
    const off = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      stop.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    stop.current = off;
  }

  function step() {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    onAt(at === "full" ? "peek" : ORDER[ORDER.indexOf(at) + 1]);
  }

  const shown = heights ? (drag ?? heights[at]) : 0;
  const style = heights
    ? ({
        "--sheet-h": `${heights.full}px`,
        "--sheet-y": `${heights.full - shown}px`,
        transition:
          drag === null
            ? "translate 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)"
            : "none",
      } as CSSProperties)
    : undefined;

  return (
    <section
      aria-label={label}
      style={style}
      className={`absolute inset-x-0 bottom-0 z-20 flex h-(--sheet-h) translate-y-(--sheet-y) flex-col rounded-t-3xl border-x-2 border-t-[3px] border-ink bg-[#fffaf0] sm:inset-x-auto sm:border-2 sm:pop-lg sm:bottom-4 sm:left-4 sm:top-(--panel-top) sm:h-auto sm:w-[23rem] sm:translate-y-0 sm:rounded-3xl ${heights ? "" : "max-sm:invisible"}`}
    >
      <div
        onPointerDown={down}
        className="shrink-0 touch-none select-none px-4 pb-2 pt-1.5 sm:touch-auto sm:select-auto sm:pt-4"
      >
        <button
          type="button"
          onClick={step}
          aria-label={
            at === "full" ? "Show less of the list" : "Show more of the list"
          }
          className="mx-auto flex h-5 w-16 cursor-grab items-center justify-center sm:hidden"
        >
          <span className="block h-1.5 w-10 rounded-full bg-ink/40" />
        </button>
        {header}
      </div>
      <div
        // Moving through the list with a keyboard opens all of it, so nothing focused is out of sight.
        onFocus={(event) => {
          if (
            heights &&
            at !== "full" &&
            event.target.matches(":focus-visible")
          )
            onAt("full");
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4"
      >
        {children}
      </div>
    </section>
  );
}
