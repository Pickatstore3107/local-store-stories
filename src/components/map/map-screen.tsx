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
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { CategoryIcon } from "@/components/category-icon";
import { GridIcon, LocateIcon, PeopleIcon } from "@/components/icons";
import { setReturnPath } from "@/components/require-account";
import { useMyFollows } from "@/components/use-my-follows";
import { fold } from "@/lib/memories";
import { NEAR_METRES, metresBetween } from "@/lib/nearby";
import type { LatLng } from "@/lib/pins";
import { CATEGORIES, type Category } from "@/lib/stories";
import { BottomSheet, type SheetAt, type SheetHeights } from "./bottom-sheet";
import {
  MemoryDetail,
  MemoryRow,
  PlaceDetail,
  ShopDetail,
  ShopRow,
  redButton,
} from "./map-details";
import { MapSearch, type Found } from "./map-search";
import { MemoryMap, withMargin, type PinnedMemory } from "./memory-map";
import { showMe, showPlace } from "./open-map";
import type { Place } from "./place-search";
import { shopAt, shopsNear, type Shop, type ShopNear } from "./shops";
import { useMyLocation, type MyLocation } from "./use-my-location";

type Open =
  | { type: "memory"; id: string }
  | { type: "shop"; shop: Shop }
  | { type: "place"; place: Place }
  | null;

const chip =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-full pl-2.5 pr-3 text-[0.8rem] font-semibold leading-none shadow-[0_2px_8px_-3px_rgb(43_29_26/0.4)] transition";
const chipOff = "bg-white text-ink hover:text-brand-red";
const chipOn = "bg-brand-red text-white";
const chipIcon = (on: boolean) => `h-4 w-4 ${on ? "text-white" : "text-brand-red"}`;

const WIDE = "(min-width: 640px)";

/** A computer's screen or a tablet: the list sits beside the map, not over it. */
function useWide() {
  return useSyncExternalStore(
    (change) => {
      const query = matchMedia(WIDE);
      query.addEventListener("change", change);
      return () => query.removeEventListener("change", change);
    },
    () => matchMedia(WIDE).matches,
    () => false,
  );
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** Whether a shop on the map is the store a memory is about. */
function sameStore(memory: PinnedMemory, shop: Shop) {
  const a = fold(memory.storeName);
  const b = fold(shop.name);
  return (
    (a.includes(b) || b.includes(a)) &&
    metresBetween(memory.pin, shop.spot) < 700
  );
}

/**
 * The Hyderabad map, the whole screen, like Google Maps: search on top, your
 * blue dot, and a list of the memories and shops near you (or in view) that
 * pulls up from the bottom on a phone and sits at the side on a computer.
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
  const wide = useWide();
  const { location, locate } = useMyLocation();

  const [following, setFollowing] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [visible, setVisible] = useState<Set<string> | null>(null);
  const [shops, setShops] = useState<{ list: ShopNear[]; zoomedOut: boolean }>({
    list: [],
    zoomedOut: true,
  });
  const [sheetAt, setSheetAt] = useState<SheetAt>("peek");
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  // How much room there is, for the list's resting heights.
  const screen = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{
    height: number;
    top: number;
    rem: number;
  } | null>(null);
  useEffect(() => {
    const box = screen.current!;
    const bar = top.current!;
    const observer = new ResizeObserver(() =>
      setSize({
        height: box.clientHeight,
        top: bar.offsetTop + bar.offsetHeight,
        rem:
          parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
      }),
    );
    observer.observe(box);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  const heights: SheetHeights | null = useMemo(() => {
    if (wide || !size) return null;
    const full = Math.max(size.height - size.top - 8, size.rem * 12);
    const half = Math.min(
      full,
      Math.round(Math.max(size.height * 0.5, size.rem * 18)),
    );
    const peek = Math.min(half, Math.round(size.rem * 9.5));
    return { peek, half, full };
  }, [wide, size]);
  const sheetPx = heights ? (dragHeight ?? heights[sheetAt]) : 0;

  /** Room to leave for the search bar and the list, so what's shown isn't under them. */
  function paddingFor(at: SheetAt): PaddingOptions {
    const rem = size?.rem ?? 16;
    if (wide)
      return { top: rem, right: rem * 3.5, bottom: rem, left: rem * 25 };
    return {
      top: size?.top ?? rem * 7,
      right: 0,
      bottom: heights ? heights[at] : rem * 9.5,
      left: 0,
    };
  }
  const padding = paddingFor(sheetAt);

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

  const me = location.status === "on" ? location : null;
  const here = me?.spot ?? null;

  const listed = useMemo(() => {
    if (here) {
      return shown
        .map((memory) => ({ memory, metres: metresBetween(here, memory.pin) }))
        .filter((item) => item.metres <= NEAR_METRES)
        .sort((a, b) => a.metres - b.metres);
    }
    return visible
      ? shown
          .filter((m) => visible.has(m.id))
          .map((memory) => ({ memory, metres: null }))
      : [];
  }, [here, shown, visible]);
  const shopList = shops.list.filter(
    (shop) => !listed.some(({ memory }) => sameStore(memory, shop)),
  );

  // The shops near you, or in view, whenever the map settles.
  useEffect(() => {
    if (!map) return;
    const update = () => {
      const zoomedOut = map.getZoom() < 14;
      const center = map.getCenter();
      const from = here ?? { lat: center.lat, lng: center.lng };
      setShops({
        list:
          here || !zoomedOut
            ? shopsNear(map, from, here ? NEAR_METRES : null)
            : [],
        zoomedOut,
      });
    };
    map.on("idle", update);
    const frame = requestAnimationFrame(update);
    return () => {
      map.off("idle", update);
      cancelAnimationFrame(frame);
    };
  }, [map, here]);

  // The blue dot, and a trip to it the first time it's found.
  const flyOnFind = useRef(false);
  const latest = useRef({ padding });
  useEffect(() => {
    latest.current = { padding };
  });
  useEffect(() => {
    if (!map) return;
    showMe(map, me);
    if (me && flyOnFind.current) {
      flyOnFind.current = false;
      map.easeTo({
        center: [me.spot.lng, me.spot.lat],
        zoom: Math.max(map.getZoom(), 15),
        padding: latest.current.padding,
      });
    }
  }, [map, me]);

  // The dark pin on the shop or place that's open.
  useEffect(() => {
    if (!map) return;
    showPlace(
      map,
      open?.type === "shop"
        ? open.shop.spot
        : open?.type === "place"
          ? open.place.spot
          : null,
    );
  }, [map, open]);

  function findMe() {
    if (me && map) {
      map.easeTo({
        center: [me.spot.lng, me.spot.lat],
        zoom: Math.max(map.getZoom(), 15),
        padding,
      });
      return;
    }
    flyOnFind.current = true;
    locate();
  }

  function focusOn(spot: LatLng) {
    map?.easeTo({
      center: [spot.lng, spot.lat],
      zoom: Math.max(map.getZoom(), 16),
      padding: paddingFor("half"),
    });
  }

  function openMemory(id: string | null) {
    if (!id) return close();
    setOpen({ type: "memory", id });
    setSheetAt("half");
  }

  function openShop(shop: Shop) {
    setOpen({ type: "shop", shop });
    setSheetAt("half");
    focusOn(shop.spot);
  }

  function close() {
    setOpen(null);
    setSheetAt("peek");
  }

  function found(result: Found) {
    if (result.type === "memory") {
      // A memory hidden by a filter shows again.
      if (!shown.some((m) => m.id === result.memory.id)) {
        setFollowing(false);
        setCategory(null);
      }
      openMemory(result.memory.id);
      return;
    }
    const { place } = result;
    setOpen({ type: "place", place });
    setSheetAt("half");
    if (place.extent && map) {
      const [west, south, east, north] = place.extent;
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: withMargin(paddingFor("half"), 24), maxZoom: 16 },
      );
    } else {
      focusOn(place.spot);
    }
  }

  // A tap on a shop's name on the map opens it; a tap on nothing closes what's open.
  function tapMap(event: MapMouseEvent) {
    if (!map) return;
    const { x, y } = event.point;
    const shop = shopAt(map, [
      [x - 10, y - 10],
      [x + 10, y + 10],
    ]);
    if (shop) openShop(shop);
    else if (open) close();
  }

  // Opens the memory named in the address (?memory=…), from a memory's page.
  function ready() {
    const id = new URLSearchParams(window.location.search).get("memory");
    if (id && shown.some((m) => m.id === id)) openMemory(id);
  }

  const openedMemory =
    open?.type === "memory"
      ? (shown.find((m) => m.id === open.id) ?? null)
      : null;
  const opened = open?.type === "memory" && !openedMemory ? null : open;
  const distanceTo = (spot: LatLng) =>
    here ? metresBetween(here, spot) : null;
  const memoriesNear = (spot: LatLng) =>
    shown
      .map((memory) => ({ memory, metres: metresBetween(spot, memory.pin) }))
      .filter((item) => item.metres <= 1000)
      .sort((a, b) => a.metres - b.metres)
      .slice(0, 5);

  const note = !following
    ? memories.length === 0
      ? "empty"
      : null
    : !member
      ? "signIn"
      : myFollows.ready && myFollows.following.size === 0
        ? "nobody"
        : null;

  const counts = [
    listed.length ? plural(listed.length, "post", "posts") : null,
    shopList.length ? plural(shopList.length, "shop", "shops") : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      ref={screen}
      className="lss-full-map relative h-full w-full overflow-clip"
      style={
        {
          "--sheet-px": `${sheetPx}px`,
          "--panel-top": `${(size?.top ?? 108) + 12}px`,
        } as CSSProperties
      }
    >
      <MemoryMap
        memories={shown}
        selectedId={openedMemory?.id ?? null}
        onSelect={openMemory}
        onVisible={setVisible}
        onReady={ready}
        onMap={setMap}
        onEmptyClick={tapMap}
        focusPadding={padding}
        fitKey={`${following}-${category}`}
        label="Map of Hyderabad with post pins"
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
          aria-label="Which pins"
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

      <button
        type="button"
        onClick={findMe}
        aria-pressed={!!me}
        title="Show where I am"
        className={`absolute right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_4px_14px_-4px_rgba(43,29,26,0.45)] transition-[bottom] duration-300 hover:bg-paper max-sm:bottom-[calc(var(--sheet-px)+1.75rem)] sm:bottom-10 ${me ? "text-[#1a73e8]" : "text-ink"} ${!wide && sheetAt === "full" ? "max-sm:hidden" : ""}`}
      >
        {location.status === "finding" ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-[#1a73e8]"
          />
        ) : (
          <LocateIcon className="h-5 w-5" />
        )}
        <span className="sr-only">Show where I am</span>
      </button>

      <BottomSheet
        at={sheetAt}
        onAt={setSheetAt}
        heights={heights}
        onDrag={setDragHeight}
        label={opened ? "Details" : here ? "Near you" : "In this area"}
        header={
          !opened && (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[1.05rem] font-bold leading-tight text-ink">
                  {here ? "Near you" : "In this area"}
                </h2>
                <p role="status" className="truncate text-[0.8rem] text-ink-soft">
                  {counts || "Nothing pinned here yet"}
                </p>
              </div>
              {location.status === "off" && (
                <button
                  type="button"
                  onClick={findMe}
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-paper pl-2.5 pr-3 text-[0.8rem] font-semibold text-ink transition hover:text-brand-red"
                >
                  <LocateIcon className="h-4 w-4 text-[#1a73e8]" />
                  Near me
                </button>
              )}
            </div>
          )
        }
      >
        {opened?.type === "memory" && openedMemory ? (
          <MemoryDetail
            memory={openedMemory}
            metres={distanceTo(openedMemory.pin)}
            showAuthor
            onClose={close}
          />
        ) : opened?.type === "shop" ? (
          <ShopDetail
            shop={opened.shop}
            metres={distanceTo(opened.shop.spot)}
            nearby={memoriesNear(opened.shop.spot)}
            onOpenMemory={openMemory}
            onClose={close}
          />
        ) : opened?.type === "place" ? (
          <PlaceDetail
            place={opened.place}
            metres={distanceTo(opened.place.spot)}
            nearby={memoriesNear(opened.place.spot)}
            onOpenMemory={openMemory}
            onClose={close}
          />
        ) : (
          <>
            {failed && (
              <p
                role="alert"
                className="mb-2 rounded-xl bg-brand-red/10 px-3 py-2 text-[0.85rem] text-ink"
              >
                The posts couldn&apos;t be loaded just now. Please try again
                in a minute.
              </p>
            )}
            {note && <MapNote note={note} />}
            <LocationNote location={location} onLocate={findMe} />

            {listed.length > 0 && (
              <section aria-label="Posts" className="mt-1">
                {shopList.length > 0 && (
                  <h3 className="text-[0.8rem] font-semibold text-ink-soft">
                    Posts
                  </h3>
                )}
                <ul className="-mx-2 mt-0.5">
                  {listed.map(({ memory, metres }) => (
                    <MemoryRow
                      key={memory.id}
                      memory={memory}
                      metres={metres}
                      onOpen={() => openMemory(memory.id)}
                    />
                  ))}
                </ul>
              </section>
            )}

            {shopList.length > 0 && (
              <section aria-label="Shops" className="mt-3">
                {listed.length > 0 && (
                  <h3 className="text-[0.8rem] font-semibold text-ink-soft">
                    {here ? "Shops within 2 km" : "Shops here"}
                  </h3>
                )}
                <ul className="-mx-2 mt-0.5">
                  {shopList.map((shop) => (
                    <ShopRow
                      key={shop.key}
                      shop={shop}
                      metres={shop.metres}
                      onOpen={() => openShop(shop)}
                    />
                  ))}
                </ul>
                <p className="mt-1 text-[0.75rem] text-ink-soft">
                  Shop names from OpenStreetMap. Some small shops are missing.
                </p>
              </section>
            )}

            {listed.length === 0 && shopList.length === 0 && (
              <p className="py-3 text-[0.9rem] text-ink-soft">
                {here
                  ? "No posts or shops found within 2 km of you yet."
                  : shops.zoomedOut
                    ? "No pins in view. Zoom in to see the shops here, or drag the map."
                    : "No posts or shops in view. Drag the map to look around."}
              </p>
            )}

            <p className="mt-5 text-[0.75rem] text-ink-soft">
              Pins show the area, never the exact spot. ·{" "}
              <Link href="/privacy" className="underline underline-offset-4">
                Privacy
              </Link>{" "}
              ·{" "}
              <Link href="/terms" className="underline underline-offset-4">
                Terms
              </Link>
            </p>
          </>
        )}
      </BottomSheet>
    </div>
  );
}

function LocationNote({
  location,
  onLocate,
}: {
  location: MyLocation;
  onLocate: () => void;
}) {
  if (location.status === "on" || location.status === "off") return null;
  if (location.status === "finding") {
    return (
      <p role="status" className="mb-2 text-[0.85rem] text-ink-soft">
        Finding where you are…
      </p>
    );
  }
  const text = {
    outside: "You're outside Hyderabad. The map covers Hyderabad only for now.",
    denied:
      "Location is blocked for this site. Tap the lock or ⓘ beside the web address, allow Location, then try again.",
    unavailable:
      "We couldn't find where you are. Check that location is on in your phone's settings, then try again.",
  }[location.status];
  return (
    <div role="alert" className="mb-2 rounded-xl bg-paper px-3 py-2 text-[0.85rem] text-ink">
      <p>{text}</p>
      {location.status !== "outside" && (
        <button
          type="button"
          onClick={onLocate}
          className="mt-1 font-semibold text-brand-red underline underline-offset-4"
        >
          Try again
        </button>
      )}
    </div>
  );
}

function MapNote({ note }: { note: "empty" | "signIn" | "nobody" }) {
  const { user } = useAuth();
  return (
    <div className="mb-2 rounded-xl bg-paper px-3 py-2 text-[0.85rem] text-ink">
      {note === "empty" && (
        <p>
          No pins yet. When you share a post about a Hyderabad store, tap where
          it was and it shows up here.
        </p>
      )}
      {note === "nobody" && (
        <p>
          You&apos;re not following anyone yet. Tap a name on any post, then
          tap Follow, and their pins show here.
        </p>
      )}
      {note === "signIn" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>Sign in to see pins from the people you follow.</p>
          <Link
            href={user ? "/welcome" : "/signin"}
            onClick={() => setReturnPath("/map")}
            className={redButton}
          >
            {user ? "Finish joining" : "Sign in"}
          </Link>
        </div>
      )}
    </div>
  );
}
