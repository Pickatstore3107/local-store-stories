"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CloseIcon, DirectionsIcon, PlaceIcon, StoreIcon } from "@/components/icons";
import { PolaroidPhoto } from "@/components/polaroid";
import { memoryPath, placeLine, textLang } from "@/lib/memories";
import { formatDistance } from "@/lib/nearby";
import { personPath } from "@/lib/people";
import type { LatLng } from "@/lib/pins";
import type { Category } from "@/lib/stories";
import type { PinnedMemory } from "./memory-map";
import type { Place } from "./place-search";
import type { Shop } from "./shops";

// What the list under the map shows: rows of memories and shops, and the
// details of whichever one is open.

const smallButton =
  "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition";
export const redButton = `${smallButton} bg-brand-red text-white hover:bg-brand-red-deep`;
export const outlineButton = `${smallButton} text-brand-red ring-1 ring-brand-red/30 hover:bg-brand-red/5`;

/** A memory's photo, small, beside its name. */
export function MemoryThumb({ memory, className = "w-11" }: { memory: PinnedMemory; className?: string }) {
  return (
    <span className={`block shrink-0 overflow-hidden rounded-xl ${className}`}>
      {memory.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
        <img
          src={memory.photoUrl}
          alt=""
          width={120}
          height={120}
          loading="lazy"
          decoding="async"
          className="aspect-square w-full bg-sand object-cover"
        />
      ) : (
        <span className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-[#ffe7a0] to-[#ffd2c4] font-hand text-lg font-bold text-brand-red">
          {memory.storeName.charAt(0)}
        </span>
      )}
    </span>
  );
}

function Row({
  onClick,
  selected,
  children,
}: {
  onClick: () => void;
  selected?: boolean;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-paper ${selected ? "bg-paper" : ""}`}
      >
        {children}
      </button>
    </li>
  );
}

export function MemoryRow({
  memory,
  metres,
  onOpen,
}: {
  memory: PinnedMemory;
  metres: number | null;
  onOpen: () => void;
}) {
  return (
    <Row onClick={onOpen}>
      <MemoryThumb memory={memory} />
      <span className="min-w-0 flex-1">
        <span lang={textLang(memory.storeName)} className="block truncate font-bold leading-tight text-ink">
          {memory.storeName}
        </span>
        <span className="block truncate text-sm text-ink-soft">
          {memory.category} · {memory.neighbourhood ?? memory.city}
        </span>
      </span>
      {metres !== null && <span className="shrink-0 text-sm font-bold text-ink-soft">{formatDistance(metres)}</span>}
    </Row>
  );
}

export function ShopRow({ shop, metres, onOpen }: { shop: Shop; metres: number; onOpen: () => void }) {
  return (
    <Row onClick={onOpen}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-yellow/25 text-brand-red">
        <StoreIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-ink">{shop.name}</span>
        <span className="block truncate text-sm text-ink-soft">{shop.kind}</span>
      </span>
      <span className="shrink-0 text-sm font-bold text-ink-soft">{formatDistance(metres)}</span>
    </Row>
  );
}

function DetailHeader({ title, lang, onClose, children }: { title: string; lang?: string; onClose: () => void; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h2 lang={lang} className="text-xl font-extrabold leading-tight text-ink">
          {title}
        </h2>
        {children}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-ink-soft hover:text-ink"
      >
        <CloseIcon className="h-5 w-5" />
        <span className="sr-only">Close</span>
      </button>
    </div>
  );
}

const away = (metres: number | null) => (metres === null ? null : `${formatDistance(metres)} away`);

export function MemoryDetail({
  memory,
  metres,
  showAuthor,
  onClose,
}: {
  memory: PinnedMemory;
  metres: number | null;
  showAuthor: boolean;
  onClose: () => void;
}) {
  return (
    <article aria-label={memory.storeName}>
      <DetailHeader title={memory.storeName} lang={textLang(memory.storeName)} onClose={onClose}>
        <p className="mt-0.5 text-sm text-ink-soft">
          {[memory.category, placeLine(memory), away(metres)].filter(Boolean).join(" · ")}
        </p>
      </DetailHeader>
      <div className="mt-3 grid grid-cols-[5.5rem_1fr] gap-3">
        <div className="self-start overflow-hidden rounded-2xl">
          <PolaroidPhoto url={memory.photoUrl} storeName={memory.storeName} eager />
        </div>
        <div className="min-w-0">
          <p lang={textLang(memory.caption)} className="line-clamp-4 font-hand text-lg leading-snug text-ink">
            {memory.caption}
          </p>
          {showAuthor && memory.authorName && (
            <p className="mt-1 text-sm text-ink-soft">
              by{" "}
              <Link
                href={personPath(memory.authorId)}
                lang={textLang(memory.authorName)}
                className="font-bold text-ink hover:text-brand-red"
              >
                {memory.authorName}
              </Link>
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={memoryPath(memory.id)} className={redButton}>
          Open memory
        </Link>
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
        <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-dashed border-brand-red bg-brand-yellow/40" />
        The pin shows the area, within about 500 m, never the exact spot.
      </p>
    </article>
  );
}

/** The share form, filled in with this store. */
export function sharePath(name: string, spot: LatLng, category: Category | null) {
  const query = new URLSearchParams({
    store: name,
    lat: spot.lat.toFixed(5),
    lng: spot.lng.toFixed(5),
  });
  if (category) query.set("category", category);
  return `/share?${query}`;
}

function directions({ lat, lng }: LatLng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function StoreActions({ name, spot, category, store }: { name: string; spot: LatLng; category: Category | null; store: boolean }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {store && (
        <Link href={sharePath(name, spot, category)} className={redButton}>
          Share a memory of it
        </Link>
      )}
      <a href={directions(spot)} target="_blank" rel="noopener noreferrer" className={outlineButton}>
        <DirectionsIcon className="h-4 w-4" />
        Directions
      </a>
    </div>
  );
}

function NearbyMemories({ items, onOpen }: { items: { memory: PinnedMemory; metres: number }[]; onOpen: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <section className="mt-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft">Memories near here</h3>
      <ul className="mt-1 -mx-2">
        {items.map(({ memory, metres }) => (
          <MemoryRow key={memory.id} memory={memory} metres={metres} onOpen={() => onOpen(memory.id)} />
        ))}
      </ul>
    </section>
  );
}

export function ShopDetail({
  shop,
  metres,
  nearby,
  onOpenMemory,
  onClose,
}: {
  shop: Shop;
  metres: number | null;
  nearby: { memory: PinnedMemory; metres: number }[];
  onOpenMemory: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <article aria-label={shop.name}>
      <DetailHeader title={shop.name} onClose={onClose}>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
          <StoreIcon className="h-4 w-4 shrink-0" />
          {[shop.kind, away(metres)].filter(Boolean).join(" · ")}
        </p>
      </DetailHeader>
      <p className="mt-3 text-ink">Remember this store? Share what it meant to you.</p>
      <StoreActions name={shop.name} spot={shop.spot} category={shop.category} store />
      <NearbyMemories items={nearby} onOpen={onOpenMemory} />
    </article>
  );
}

export function PlaceDetail({
  place,
  metres,
  nearby,
  onOpenMemory,
  onClose,
}: {
  place: Place;
  metres: number | null;
  nearby: { memory: PinnedMemory; metres: number }[];
  onOpenMemory: (id: string) => void;
  onClose: () => void;
}) {
  const Icon = place.store ? StoreIcon : PlaceIcon;
  return (
    <article aria-label={place.name}>
      <DetailHeader title={place.name} onClose={onClose}>
        <p className="mt-0.5 flex items-start gap-1.5 text-sm text-ink-soft">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{[place.detail, away(metres)].filter(Boolean).join(" · ")}</span>
        </p>
      </DetailHeader>
      {place.store && <p className="mt-3 text-ink">Remember this store? Share what it meant to you.</p>}
      <StoreActions name={place.name} spot={place.spot} category={place.category} store={place.store} />
      <NearbyMemories items={nearby} onOpen={onOpenMemory} />
      {!nearby.length && <p className="mt-5 text-sm text-ink-soft">No memories near here yet.</p>}
    </article>
  );
}
