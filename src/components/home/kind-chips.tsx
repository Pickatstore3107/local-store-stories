"use client";

import { CATEGORIES, type Category } from "@/lib/stories";
import { CategoryIcon } from "../category-icon";
import { GridIcon } from "../icons";
import { setWallFilters, useWallFilters } from "../use-wall-filters";

// Each kind's drawing in red or amber, so the row isn't all one colour.
const AMBER = new Set<Category>(["Cafes", "Bakeries", "Kirana Stores", "Bookstores", "Festival Memories", "Local Legends"]);

const pill =
  "flex h-[2.35rem] shrink-0 items-center gap-1.5 rounded-full pl-2.5 pr-3.5 text-[0.82rem] font-semibold leading-none transition";
const on = "bg-brand-red text-white shadow-[0_4px_10px_rgb(163_23_27/0.25)]";
const off = "bg-white text-ink ring-1 ring-ink/[0.06] hover:text-brand-red";

/**
 * Every kind of place as a row of small pills, "All" first. Picking one
 * shows only that kind in Trending and in the posts below.
 */
export function KindChips() {
  const filters = useWallFilters();
  const { category } = filters;

  function pick(next: Category | null) {
    setWallFilters({ ...filters, query: "", category: next });
  }

  return (
    <div role="group" aria-label="Kinds of places" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        aria-pressed={category === null}
        onClick={() => pick(null)}
        className={`${pill} ${category === null ? on : off}`}
      >
        <GridIcon className="h-[1.1rem] w-[1.1rem]" />
        All
      </button>
      {CATEGORIES.map((each) => {
        const picked = category === each;
        return (
          <button
            key={each}
            type="button"
            aria-pressed={picked}
            onClick={() => pick(picked ? null : each)}
            className={`${pill} ${picked ? on : off}`}
          >
            <CategoryIcon
              category={each}
              className={`h-[1.1rem] w-[1.1rem] ${picked ? "text-white" : AMBER.has(each) ? "text-[#d98200]" : "text-brand-red"}`}
            />
            <span className="whitespace-nowrap">{each}</span>
          </button>
        );
      })}
    </div>
  );
}
