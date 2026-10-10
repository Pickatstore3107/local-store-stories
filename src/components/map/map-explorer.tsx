"use client";

import Link from "next/link";
import { useState } from "react";
import { PolaroidPhoto } from "@/components/polaroid";
import { memoryPath, placeLine, textLang } from "@/lib/memories";
import { personPath } from "@/lib/people";
import { MemoryMap, type PinnedMemory } from "./memory-map";

/**
 * The map with a memory opened over it when its pin is tapped, and the
 * memories in view as a row of prints underneath.
 */
export function MapExplorer({
  memories,
  fitKey,
  label,
  showAuthors = true,
  openFromAddress = false,
}: {
  memories: PinnedMemory[];
  fitKey?: string;
  label: string;
  showAuthors?: boolean;
  /** Opens the memory named in the address (?memory=…) once the map is ready. */
  openFromAddress?: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [visible, setVisible] = useState<Set<string> | null>(null);
  // A memory filtered out of the map closes.
  const selected = memories.find((m) => m.id === picked) ?? null;
  const inView = visible ? memories.filter((m) => visible.has(m.id)) : [];

  function ready() {
    if (!openFromAddress) return;
    const id = new URLSearchParams(window.location.search).get("memory");
    if (id && memories.some((m) => m.id === id)) setPicked(id);
  }

  return (
    <>
      <div className="relative mt-6">
        <MemoryMap
          memories={memories}
          selectedId={selected?.id ?? null}
          onSelect={setPicked}
          onVisible={setVisible}
          onReady={ready}
          fitKey={fitKey}
          label={label}
        />
        {selected && (
          <MapCard memory={selected} showAuthor={showAuthors} onClose={() => setPicked(null)} />
        )}
        <p className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-8rem)] items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-ink-soft shadow-sm">
          <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-dashed border-brand-red bg-brand-yellow/40" />
          Pins show the area, within about 500 m
        </p>
      </div>

      {visible && (
        <section aria-labelledby="in-view-heading" className="mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="in-view-heading" className="text-sm font-bold uppercase tracking-wider text-ink-soft">
              In this part of the map
            </h2>
            <p className="text-sm text-ink-soft">
              {inView.length === 1 ? "1 post" : `${inView.length} posts`}
            </p>
          </div>
          {inView.length === 0 ? (
            <p className="py-6 text-ink-soft">
              No pins here. Zoom out or drag the map to see more.
            </p>
          ) : (
            <ul className="-mx-4 mt-2 flex gap-4 overflow-x-auto px-4 pb-6 pt-4 sm:-mx-5 sm:gap-5 sm:px-5">
              {inView.map((memory) => (
                <li key={memory.id} className="w-36 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPicked(memory.id)}
                    aria-pressed={memory.id === selected?.id}
                    className={`block w-full rounded-[1.4rem] bg-white p-1.5 pb-3 text-left lift ring-2 transition hover:-translate-y-1 ${
                      memory.id === selected?.id ? "ring-brand-yellow" : "ring-transparent"
                    }`}
                  >
                    <span className="block overflow-hidden rounded-2xl">
                      <PolaroidPhoto url={memory.photoUrl} storeName={memory.storeName} />
                    </span>
                    <span lang={textLang(memory.storeName)} className="mt-2 block px-1 font-bold leading-tight text-ink">
                      {memory.storeName}
                    </span>
                    <span className="block truncate px-1 text-xs text-ink-soft">
                      {memory.neighbourhood ?? memory.city}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

/** A memory opened from its pin: over the bottom of the map on a phone, at its side on a computer. */
function MapCard({
  memory,
  showAuthor,
  onClose,
}: {
  memory: PinnedMemory;
  showAuthor: boolean;
  onClose: () => void;
}) {
  return (
    <article
      aria-label={memory.storeName}
      className="absolute inset-x-3 bottom-3 z-10 grid grid-cols-[6rem_1fr] gap-4 rounded-3xl bg-white p-3 lift ring-1 ring-ink/5 sm:bottom-auto sm:right-auto sm:top-3 sm:w-96"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-ink-soft hover:bg-paper hover:text-ink"
      >
        <span aria-hidden="true">×</span>
        <span className="sr-only">Close</span>
      </button>
      <div className="self-start overflow-hidden rounded-2xl">
        <PolaroidPhoto url={memory.photoUrl} storeName={memory.storeName} eager />
      </div>
      <div className="min-w-0 pr-6">
        <h3 lang={textLang(memory.storeName)} className="text-lg font-bold leading-tight text-ink">
          {memory.storeName}
        </h3>
        <p className="mt-0.5 text-sm text-ink-soft">
          {placeLine(memory)} · {memory.category}
        </p>
        <p lang={textLang(memory.caption)} className="mt-2 line-clamp-3 font-hand text-lg leading-snug text-ink">
          {memory.caption}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {showAuthor && memory.authorName && (
            <span className="text-sm text-ink-soft">
              by{" "}
              <Link
                href={personPath(memory.authorId)}
                lang={textLang(memory.authorName)}
                className="font-bold text-ink hover:text-brand-red"
              >
                {memory.authorName}
              </Link>
            </span>
          )}
          <Link
            href={memoryPath(memory.id)}
            className="rounded-full bg-brand-red px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-red-deep"
          >
            Open post
          </Link>
        </div>
      </div>
    </article>
  );
}
