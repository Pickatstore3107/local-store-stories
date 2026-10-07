import type { Metadata } from "next";
import Link from "next/link";
import { primaryButton } from "@/components/ui";
import { depthLine, inspiredLine, type Chain } from "@/lib/chain";
import { loadChains } from "@/lib/server/chain";
import { ChainTree } from "./chain-tree";
import { ZoomFrame } from "./zoom-frame";

export const metadata: Metadata = {
  title: "The Memory Chain · Local Stores & Their Stories",
  description:
    "One memory leads to the next: see how friends passed their memories of local stores on to each other.",
};

export default async function ChainPage() {
  const chains = await loadChains();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-extrabold leading-tight text-brand-red sm:text-5xl">
            The Memory Chain
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-ink-soft">
            Every memory comes with three invites to pass on. Follow how one person&apos;s memory
            led their friends to share theirs, and their friends after them.
          </p>
        </div>
        <Link href="/share" className={primaryButton}>
          Share your memory
        </Link>
      </div>

      {chains === null ? (
        <p role="alert" className="mt-16 text-center text-ink-soft">
          The Memory Chain couldn&apos;t be loaded just now. Please try again in a minute.
        </p>
      ) : chains.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-hand text-2xl text-ink">The first chain hasn&apos;t started yet.</p>
          <p className="mx-auto mt-2 max-w-md text-ink-soft">
            Share a memory, then pass it on with your three invites. When a friend joins and
            their memory is on the Wall, your chain begins here.
          </p>
        </div>
      ) : (
        <ol className="mt-12 flex flex-col gap-16">
          {chains.map((chain) => (
            <li key={chain.root.key}>
              <ChainSection chain={chain} />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function ChainSection({ chain }: { chain: Chain }) {
  const { root } = chain;
  const starter = root.name ?? "a friend";
  return (
    <section aria-labelledby={`chain-${root.key}`}>
      <h2 id={`chain-${root.key}`} className="font-hand text-2xl font-bold text-ink sm:text-3xl">
        Started by {starter}
        {root.name && root.city && <span className="text-ink-soft">, {root.city}</span>}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        {inspiredLine(chain.inspired)} · {depthLine(chain.depth)}
      </p>
      <div className="mt-4">
        <ZoomFrame label={`the chain started by ${starter}`}>
          <ChainTree root={root} />
        </ZoomFrame>
      </div>
    </section>
  );
}
