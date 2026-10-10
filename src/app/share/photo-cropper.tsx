"use client";

import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { TurnIcon } from "@/components/icons";
import { clampCrop, drawCrop, MAX_ZOOM, turnRight, type Crop } from "@/lib/media";

/**
 * One photo in its four-by-five frame. Drag it to move it, pinch or use
 * the slider to zoom, and turn it a quarter at a time. What you see here
 * is exactly what's posted.
 */
export function PhotoCropper({
  image,
  crop,
  onChange,
  label,
}: {
  image: ImageBitmap;
  crop: Crop;
  onChange: (crop: Crop) => void;
  /** "Photo 2 of 3", for screen readers. */
  label: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Fingers on the photo, by pointer ID, and where each last was.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const latest = useRef(crop);
  useEffect(() => {
    latest.current = crop;
  });

  const set = (next: Crop) => onChange(clampCrop(image.width, image.height, next));

  // Draws at the screen's full sharpness, again whenever the frame changes size.
  useEffect(() => {
    const element = canvas.current!;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.round(element.clientWidth * ratio);
      const height = Math.round(element.clientHeight * ratio);
      if (!width || !height) return;
      if (element.width !== width || element.height !== height) {
        element.width = width;
        element.height = height;
      }
      const context = element.getContext("2d");
      if (context) drawCrop(context, image, crop, width, height);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [image, crop]);

  function down(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const last = pointers.current.get(event.pointerId);
    if (!last) return;
    const box = event.currentTarget.getBoundingClientRect();
    const others = [...pointers.current].filter(([id]) => id !== event.pointerId);
    const now = latest.current;
    if (others.length === 0) {
      set({
        ...now,
        x: now.x + (event.clientX - last.x) / box.width,
        y: now.y + (event.clientY - last.y) / box.height,
      });
    } else {
      // Two fingers: zoom by how much further apart they are.
      const [, other] = others[0];
      const before = Math.hypot(last.x - other.x, last.y - other.y);
      const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (before > 0) set({ ...now, zoom: now.zoom * (after / before) });
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function up(event: PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId);
  }

  function keys(event: KeyboardEvent<HTMLCanvasElement>) {
    const step = 0.02;
    const moves: Record<string, Partial<Crop>> = {
      ArrowLeft: { x: crop.x - step },
      ArrowRight: { x: crop.x + step },
      ArrowUp: { y: crop.y - step },
      ArrowDown: { y: crop.y + step },
      "+": { zoom: crop.zoom + 0.1 },
      "=": { zoom: crop.zoom + 0.1 },
      "-": { zoom: crop.zoom - 0.1 },
    };
    const change = moves[event.key];
    if (!change) return;
    event.preventDefault();
    set({ ...crop, ...change });
  }

  return (
    <div>
      <canvas
        ref={canvas}
        tabIndex={0}
        role="img"
        aria-label={`${label}. Drag to move it in the frame, or use the arrow keys.`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={keys}
        className="mx-auto block aspect-[4/5] w-full max-w-[36dvh] cursor-grab touch-none rounded-2xl bg-sand outline-none focus-visible:ring-2 focus-visible:ring-brand-red/50 active:cursor-grabbing"
      />
      <div className="mt-2.5 flex items-center gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-2.5 text-[0.85rem] font-semibold text-ink-soft">
          Zoom
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={crop.zoom}
            onChange={(event) => set({ ...crop, zoom: Number(event.target.value) })}
            className="min-w-0 flex-1 accent-brand-red"
          />
        </label>
        <button
          type="button"
          onClick={() => set(turnRight(crop))}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-[0.85rem] font-bold text-ink ring-1 ring-ink/15 transition hover:bg-sand/60"
        >
          <TurnIcon className="h-4 w-4" />
          Turn
        </button>
      </div>
    </div>
  );
}
