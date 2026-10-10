"use client";

import type {
  MapMouseEvent,
  Map as MapLibreMap,
  PaddingOptions,
} from "maplibre-gl";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { CategoryIcon } from "@/components/category-icon";
import {
  CloseIcon,
  GridIcon,
  LocateIcon,
  PeopleIcon,
} from "@/components/icons";
import { setReturnPath } from "@/components/require-account";
import { useMyFollows } from "@/components/use-my-follows";
import { metresBetween } from "@/lib/nearby";
import type { LatLng } from "@/lib/pins";
import { CATEGORIES, type Category } from "@/lib/stories";
import {
  NoteCard,
  PostCards,
  StoreCard,
  outlineButton,
  redButton,
  type Card,
  type Store,
} from "./map-cards";
import { MapSearch, type Found } from "./map-search";
import {
  MemoryMap,
  centerOffset,
  fitTo,
  pinSpots,
  withMargin,
  type PinnedMemory,
} from "./memory-map";
import { showMe, showPlace } from "./open-map";
import { shopAt } from "./shops";
import { useMyLocation, type MyLocation } from "./use-my-location";

const chip =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-full pl-2.5 pr-3 text-[0.8rem] font-semibold leading-none shadow-[0_2px_8px_-3px_rgb(43_29_26/0.4)] transition";
const chipOff = "bg-white text-ink hover:text-brand-red";
const chipOn = "bg-brand-red text-white";
const chipIcon = (on: boolean) =>
  `h-4 w-4 ${on ? "text-white" : "text-brand-red"}`;

/** The part of the map in view, past the search bar and the cards, when it last settled. */
type View = {
  west: number;
  south: number;
  east: number;
  north: number;
  center: LatLng;
};

// Moves of the map made by swiping the cards don't change which cards there are.
const KEEP_CARDS = { keepCards: true };

function viewOf(map: MapLibreMap, padding: PaddingOptions): View {
  const { clientWidth: width, clientHeight: height } = map.getContainer();
  const top = Math.min(padding.top ?? 0, height / 2);
  const bottom = Math.max(height - (padding.bottom ?? 0), top + 1);
  const a = map.unproject([padding.left ?? 0, top]);
  const b = map.unproject([width - (padding.right ?? 0), bottom]);
  const center = map.unproject([width / 2, (top + bottom) / 2]);
  return {
    west: Math.min(a.lng, b.lng),
    east: Math.max(a.lng, b.lng),
    south: Math.min(a.lat, b.lat),
    north: Math.max(a.lat, b.lat),
    center: { lat: center.lat, lng: center.lng },
  };
}

const inside = (view: View, { lat, lng }: LatLng) =>
  lat >= view.south &&
  lat <= view.north &&
  lng >= view.west &&
  lng <= view.east;

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * The Hyderabad map, the whole screen: search on top, posts as small square
 * photos, and the posts in view as cards along the bottom to swipe through,
 * like Airbnb. Swiping moves the map to each post; tapping a photo brings
 * its card up. Near me shows the posts around you.
 */
export function MapScreen({
  memories,
  failed = false,
}: {
  memories: PinnedMemory[];
  failed?: boolean;
}) {
  const { user, consent } = useAuth();
  const myFollows = useMyFollows();
  const member = !!user && !!consent;
  const { location, locate } = useMyLocation();

  const [following, setFollowing] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // A post to bring into view once the map is ready, from ?memory=…
  const [waiting, setWaiting] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  // A place found by searching, shown with a dark pin.
  const [place, setPlace] = useState<LatLng | null>(null);
  const [hideLocationNote, setHideLocationNote] = useState(false);

  // How much of the map the search bar and the cards cover.
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [covered, setCovered] = useState({ top: 112, bottom: 160 });
  useEffect(() => {
    const bar = top.current!;
    const cards = bottom.current!;
    const observer = new ResizeObserver(() =>
      setCovered({
        top: bar.offsetTop + bar.offsetHeight,
        bottom: cards.offsetHeight,
      }),
    );
    observer.observe(bar);
    observer.observe(cards);
    return () => observer.disconnect();
  }, []);
  // Room to leave when moving the map, so what it moves to isn't under them.
  const padding = useMemo<PaddingOptions>(
    () => ({
      top: covered.top + 4,
      bottom: covered.bottom + 4,
      left: 12,
      right: 12,
    }),
    [covered],
  );

  const shown = useMemo(
    () =>
      memories.filter(
        (m) =>
          (!following || myFollows.following.has(m.authorId)) &&
          (!category || m.category === category),
      ),
    [memories, following, myFollows.following, category],
  );
  const categories = CATEGORIES.filter(
    (c) => c === category || memories.some((m) => m.category === c),
  );
  const spots = useMemo(() => pinSpots(shown), [shown]);

  const me = location.status === "on" ? location : null;
  const here = me?.spot ?? null;

  // The posts in view, nearest you first when Near me is on, else nearest the middle.
  const cards: Card[] = useMemo(() => {
    if (!view) return [];
    const from = here ?? view.center;
    return shown
      .filter((m) => inside(view, spots.get(m.id) ?? m.pin))
      .map((memory) => ({
        memory,
        metres: here ? metresBetween(here, memory.pin) : null,
        order: metresBetween(from, spots.get(memory.id) ?? memory.pin),
      }))
      .sort((a, b) => a.order - b.order)
      .map(({ memory, metres }) => ({ memory, metres }));
  }, [view, shown, spots, here]);
  const active =
    cards.find((card) => card.memory.id === activeId) ?? cards[0] ?? null;

  // Which cards there are changes when the map settles somewhere new, unless
  // a swipe moved it.
  const latest = useRef({ padding });
  useEffect(() => {
    latest.current = { padding };
  });
  useEffect(() => {
    if (!map) return;
    const settled = (event: { keepCards?: boolean }) => {
      if (!event.keepCards) setView(viewOf(map, latest.current.padding));
    };
    settled({});
    map.on("moveend", settled);
    map.on("resize", settled);
    return () => {
      map.off("moveend", settled);
      map.off("resize", settled);
    };
  }, [map]);

  // The blue dot, and a trip to it the first time it's found.
  const flyOnFind = useRef(false);
  useEffect(() => {
    if (!map) return;
    showMe(map, me);
    if (me && flyOnFind.current) {
      flyOnFind.current = false;
      map.easeTo({
        center: [me.spot.lng, me.spot.lat],
        zoom: Math.max(map.getZoom(), 15),
        offset: centerOffset(latest.current.padding),
      });
    }
  }, [map, me]);

  // The dark pin on the store or place being looked at.
  useEffect(() => {
    if (map) showPlace(map, store?.spot ?? place);
  }, [map, store, place]);

  // A post from the address or a search, once the map has fitted everything in.
  const goToLater = useRef(goTo);
  useEffect(() => {
    goToLater.current = goTo;
  });
  useEffect(() => {
    if (!map || !waiting) return;
    goToLater.current(waiting);
  }, [map, waiting]);

  function findMe() {
    setHideLocationNote(false);
    if (me && map) {
      map.easeTo({
        center: [me.spot.lng, me.spot.lat],
        zoom: Math.max(map.getZoom(), 15),
        offset: centerOffset(padding),
      });
      return;
    }
    flyOnFind.current = true;
    locate();
  }

  /** Brings a post to the middle of the map, closer in, with its card. */
  function goTo(id: string) {
    const spot = spots.get(id);
    setWaiting(null);
    if (!map || !spot) return;
    setStore(null);
    setActiveId(id);
    map.easeTo({
      center: [spot.lng, spot.lat],
      zoom: Math.max(map.getZoom(), 15),
      offset: centerOffset(padding),
    });
  }

  // A swipe moves the map along to the post in the middle, at the same zoom.
  function swiped(id: string) {
    setActiveId(id);
    const spot = spots.get(id);
    if (map && spot)
      map.easeTo(
        { center: [spot.lng, spot.lat], offset: centerOffset(padding), duration: 450 },
        KEEP_CARDS,
      );
  }

  // A tapped photo brings its card to the middle.
  function picked(id: string | null) {
    if (!id) return;
    setStore(null);
    if (!cards.some((card) => card.memory.id === id) && map)
      setView(viewOf(map, padding));
    setActiveId(id);
  }

  function openStore(next: Store) {
    setStore(next);
    setPlace(null);
    map?.easeTo({
      center: [next.spot.lng, next.spot.lat],
      zoom: Math.max(map.getZoom(), 16),
      offset: centerOffset(padding),
    });
  }

  function found(result: Found) {
    if (result.type === "memory") {
      // A post hidden by a filter shows again.
      if (!shown.some((m) => m.id === result.memory.id)) {
        setFollowing(false);
        setCategory(null);
        setWaiting(result.memory.id);
      } else {
        goTo(result.memory.id);
      }
      setPlace(null);
      return;
    }
    const { place: found } = result;
    if (found.store) {
      openStore({
        name: found.name,
        detail: found.detail,
        spot: found.spot,
        category: found.category,
      });
      return;
    }
    // An area or street: the map goes there and the cards show its posts.
    setStore(null);
    setPlace(found.spot);
    if (!map) return;
    if (found.extent) {
      const [west, south, east, north] = found.extent;
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: withMargin(padding, 16), maxZoom: 16 },
      );
    } else {
      map.easeTo({
        center: [found.spot.lng, found.spot.lat],
        zoom: Math.max(map.getZoom(), 15),
        offset: centerOffset(padding),
      });
    }
  }

  // A tap on a shop's name on the map opens it; a tap on nothing closes it.
  function tapMap(event: MapMouseEvent) {
    if (!map) return;
    const { x, y } = event.point;
    const shop = shopAt(map, [
      [x - 10, y - 10],
      [x + 10, y + 10],
    ]);
    if (shop) {
      openStore({
        name: shop.name,
        detail: shop.kind,
        spot: shop.spot,
        category: shop.category,
      });
      return;
    }
    setStore(null);
    setPlace(null);
  }

  // Opens the post named in the address (?memory=…), from a post's page.
  function ready() {
    const id = new URLSearchParams(window.location.search).get("memory");
    if (id && shown.some((m) => m.id === id)) setWaiting(id);
  }

  function showAll() {
    if (map) fitTo(map, [...spots.values()], true, withMargin(padding));
  }

  const note = !following
    ? memories.length === 0
      ? "empty"
      : null
    : !member
      ? "signIn"
      : myFollows.ready && myFollows.following.size === 0
        ? "nobody"
        : null;

  return (
    <div
      className="lss-full-map relative h-full w-full overflow-clip"
      style={{ "--cards-px": `${covered.bottom}px` } as CSSProperties}
    >
      <MemoryMap
        memories={shown}
        selectedId={store ? null : (active?.memory.id ?? null)}
        onSelect={picked}
        onReady={ready}
        onMap={setMap}
        onEmptyClick={tapMap}
        focusPadding={padding}
        moveToSelected={false}
        fitKey={`${following}-${category}`}
        label="Map of Hyderabad with posts as photos"
        credits="bottom-left"
        framed={false}
        className="absolute inset-0"
      />

      <div
        ref={top}
        className="pointer-events-none absolute inset-x-0 top-0 z-30 space-y-2 p-3 sm:right-auto sm:left-4 sm:top-4 sm:w-[23rem] sm:p-0"
      >
        <MapSearch memories={memories} onFound={found} />
        <div
          role="group"
          aria-label="Which posts"
          className="pointer-events-auto -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            aria-pressed={!following && !category}
            onClick={() => {
              setFollowing(false);
              setCategory(null);
            }}
            className={`${chip} ${!following && !category ? chipOn : chipOff}`}
          >
            <GridIcon className={chipIcon(!following && !category)} />
            All
          </button>
          <button
            type="button"
            aria-pressed={following}
            onClick={() => setFollowing(!following)}
            className={`${chip} ${following ? chipOn : chipOff}`}
          >
            <PeopleIcon className={chipIcon(following)} />
            Following
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(category === c ? null : c)}
              className={`${chip} ${category === c ? chipOn : chipOff}`}
            >
              <CategoryIcon category={c} className={chipIcon(category === c)} />
              <span className="whitespace-nowrap">{c}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        ref={bottom}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 pb-[calc(var(--bar-lift)+0.4rem)] sm:pb-4"
      >
        <div className="mb-1.5 flex items-end justify-end gap-2 px-3">
          {!hideLocationNote && (
            <LocationNote
              location={location}
              onLocate={findMe}
              onClose={() => setHideLocationNote(true)}
            />
          )}
          <button
            type="button"
            onClick={findMe}
            aria-pressed={!!me}
            className={`pointer-events-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white pl-2.5 pr-3.5 text-[0.8rem] font-semibold shadow-[0_4px_14px_-4px_rgb(43_29_26/0.5)] transition hover:text-brand-red ${me ? "text-[#1a73e8]" : "text-ink"}`}
          >
            {location.status === "finding" ? (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-[#1a73e8]"
              />
            ) : (
              <LocateIcon className="h-4 w-4 text-[#1a73e8]" />
            )}
            Near me
          </button>
        </div>

        {/* As tall as the cards even before they come, so the map leaves room for them from the start. */}
        <div className="flex min-h-[7.65rem] flex-col justify-end">
          {store ? (
            <StoreCard
              store={store}
              metres={here ? metresBetween(here, store.spot) : null}
              onClose={() => setStore(null)}
            />
          ) : failed ? (
            <NoteCard alert>
              The posts couldn&apos;t be loaded just now. Please try again in a
              minute.
            </NoteCard>
          ) : note ? (
            <MapNote note={note} />
          ) : cards.length > 0 ? (
            <PostCards
              cards={cards}
              activeId={active?.memory.id ?? null}
              onSwipe={swiped}
            />
          ) : view ? (
            <NoteCard>
              <p className="font-semibold">
                {here
                  ? "No posts near you yet."
                  : "No posts in this part of the map."}
              </p>
              <p className="mt-0.5 text-ink-soft">
                Tap a shop&apos;s name on the map to share a post about it.
              </p>
              {shown.length > 0 && (
                <button
                  type="button"
                  onClick={showAll}
                  className={`${outlineButton} mt-2.5`}
                >
                  See all {plural(shown.length, "post", "posts")}
                </button>
              )}
            </NoteCard>
          ) : null}
        </div>
        <p role="status" className="sr-only">
          {view && !store && !note
            ? plural(cards.length, "post", "posts") +
              (here ? " near you" : " in view")
            : ""}
        </p>
      </div>
    </div>
  );
}

function LocationNote({
  location,
  onLocate,
  onClose,
}: {
  location: MyLocation;
  onLocate: () => void;
  onClose: () => void;
}) {
  if (
    location.status === "on" ||
    location.status === "off" ||
    location.status === "finding"
  )
    return null;
  const text = {
    outside: "You're outside Hyderabad. The map covers Hyderabad only for now.",
    denied:
      "Location is blocked for this site. Tap the lock or ⓘ beside the web address, allow Location, then try again.",
    unavailable:
      "We couldn't find where you are. Check that location is on in your phone's settings, then try again.",
  }[location.status];
  return (
    <div
      role="alert"
      className="pointer-events-auto flex min-w-0 flex-1 items-start gap-2 rounded-2xl bg-white px-3 py-2 text-[0.8rem] leading-snug text-ink shadow-[0_4px_14px_-4px_rgb(43_29_26/0.5)]"
    >
      <div className="min-w-0 flex-1">
        <p>{text}</p>
        {location.status !== "outside" && (
          <button
            type="button"
            onClick={onLocate}
            className="mt-0.5 font-semibold text-brand-red underline underline-offset-4"
          >
            Try again
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-soft hover:text-ink"
      >
        <CloseIcon className="h-3.5 w-3.5" />
        <span className="sr-only">Close</span>
      </button>
    </div>
  );
}

function MapNote({ note }: { note: "empty" | "signIn" | "nobody" }) {
  const { user } = useAuth();
  if (note === "empty") {
    return (
      <NoteCard>
        <p>
          No posts on the map yet. When you share a post about a Hyderabad
          store, tap where it was and it shows up here.
        </p>
        <Link href="/share" className={`${redButton} mt-2.5`}>
          Share a post
        </Link>
      </NoteCard>
    );
  }
  if (note === "nobody") {
    return (
      <NoteCard>
        You&apos;re not following anyone yet. Tap a name on any post, then tap
        Follow, and their posts show here.
      </NoteCard>
    );
  }
  return (
    <NoteCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>Sign in to see posts from the people you follow.</p>
        <Link
          href={user ? "/welcome" : "/signin"}
          onClick={() => setReturnPath("/map")}
          className={redButton}
        >
          {user ? "Finish joining" : "Sign in"}
        </Link>
      </div>
    </NoteCard>
  );
}
