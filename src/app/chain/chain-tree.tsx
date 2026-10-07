import Link from "next/link";
import type { CSSProperties } from "react";
import type { ChainPerson } from "@/lib/chain";
import { memoryPath, textLang, tilt } from "@/lib/memories";
import { personPath } from "@/lib/people";

const MEMORIES_SHOWN = 3;

/** One person: a small print of their newest memory, or "a friend". */
function Person({ person }: { person: ChainPerson }) {
  if (!person.name) {
    return (
      <div className="flex h-14 w-28 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-ink/20 bg-paper font-hand text-ink-soft">
        a friend
      </div>
    );
  }
  const newest = person.memories[0];
  return (
    <div
      style={{ "--tilt": `${tilt(newest?.id ?? person.key) / 2}deg` } as CSSProperties}
      className="w-40 shrink-0 rotate-(--tilt) bg-white p-2 pb-3 shadow-[0_10px_24px_-14px_rgba(43,29,26,0.55)] ring-1 ring-ink/5"
    >
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
        <img
          src={person.photoUrl}
          alt=""
          width={240}
          height={240}
          loading="lazy"
          decoding="async"
          className="aspect-square w-full bg-paper object-cover [filter:sepia(0.12)_saturate(1.05)_contrast(1.02)]"
        />
      ) : (
        <div className="aspect-square w-full bg-paper" />
      )}
      <p lang={textLang(person.name)} className="mt-2 px-1 font-hand text-lg font-bold leading-tight">
        {person.uid ? (
          <Link
            href={personPath(person.uid)}
            prefetch={false}
            className="underline decoration-ink/25 underline-offset-4 hover:text-brand-red hover:decoration-brand-red"
          >
            {person.name}
          </Link>
        ) : (
          person.name
        )}
      </p>
      {person.city && <p className="px-1 text-xs text-ink-soft">{person.city}</p>}
      <ul className="mt-1 space-y-0.5 px-1 text-sm leading-snug">
        {person.memories.slice(0, MEMORIES_SHOWN).map((memory) => (
          <li key={memory.id}>
            <Link
              href={memoryPath(memory.id)}
              lang={textLang(memory.storeName)}
              className="font-bold text-brand-red underline-offset-4 hover:underline"
            >
              {memory.storeName}
            </Link>
          </li>
        ))}
        {person.memories.length > MEMORIES_SHOWN && (
          <li className="text-ink-soft">and {person.memories.length - MEMORIES_SHOWN} more</li>
        )}
      </ul>
    </div>
  );
}

/** The friends who joined through someone's invites, and theirs, and so on. */
function Branch({ person }: { person: ChainPerson }) {
  if (!person.children.length) return null;
  return (
    <ul
      className="chain-branch"
      aria-label={`Joined through ${person.name ? `${person.name}'s` : "a friend's"} invites`}
    >
      {person.children.map((child) => (
        <li key={child.key} className="chain-link">
          <Person person={child} />
          <Branch person={child} />
        </li>
      ))}
    </ul>
  );
}

/** A chain as a tree that grows from its first person, left to right. */
export function ChainTree({ root }: { root: ChainPerson }) {
  return (
    <div className="flex items-center py-2 pr-2">
      <Person person={root} />
      <Branch person={root} />
    </div>
  );
}
