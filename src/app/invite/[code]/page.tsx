import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PolaroidCard } from "@/components/polaroid";
import { loadInvite } from "@/lib/server/chain";
import { InviteActions } from "./invite-actions";

const SITE = "Local Stores & Their Stories";

// Like a memory's page, each invite's page is built on its first visit and
// then stored. The build needs one example address to check the page with.
export function generateStaticParams() {
  return [{ code: "example" }];
}

export async function generateMetadata({ params }: PageProps<"/invite/[code]">): Promise<Metadata> {
  const { code } = await params;
  const invite = await loadInvite(code);
  const from = invite?.status === "open" ? invite.inviter?.name : null;
  const title = from ? `${from} passed you a memory` : "Pass the memory";
  const description = "Share a memory of a local store you never forgot, and pass it on.";
  return {
    title: `${title} · ${SITE}`,
    description,
    // Personal links: keep them out of search engines.
    robots: { index: false, follow: false },
    openGraph: {
      siteName: SITE,
      title,
      description,
      images:
        invite?.status === "open" && invite.shareImageUrl
          ? [{ url: invite.shareImageUrl, width: 1200, height: 630, alt: "A memory of a local store" }]
          : undefined,
    },
  };
}

export default function InvitePage({ params }: PageProps<"/invite/[code]">) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-10">
      <Suspense fallback={<p className="py-24 text-center text-ink-soft">Loading…</p>}>
        {params.then(({ code }) => (
          <InviteContent code={code} />
        ))}
      </Suspense>
    </main>
  );
}

async function InviteContent({ code }: { code: string }) {
  const invite = await loadInvite(code);
  const open = invite?.status === "open" ? invite : null;
  const name = open?.inviter?.name ?? null;

  return (
    <article>
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-ink-soft">Pass the memory</p>
      <h1 className="mt-3 font-hand text-4xl font-bold leading-tight text-brand-red">
        {open ? `${name ?? "A friend"} passed you a memory` : "Some places never leave us"}
      </h1>
      {open && (
        <p className="mt-4 text-lg leading-relaxed text-ink">
          {open.memory
            ? `${name ?? "They"} remembered ${open.memory.storeName}, and picked you to share a store you never forgot.`
            : `${name ?? "They"} shared a memory of a local store, and picked you to share yours.`}
        </p>
      )}

      {open?.memory && (
        <div className="mx-auto mt-10 max-w-xs">
          <PolaroidCard memory={open.memory} eager />
        </div>
      )}

      <div className="mt-10">
        <InviteActions code={code} />
      </div>

      <section className="mt-12 border-t border-ink/10 pt-8 text-sm leading-relaxed text-ink-soft">
        <h2 className="font-bold text-ink">What is this?</h2>
        <p className="mt-2">
          Local Stores &amp; Their Stories is a people-first campaign by Pick at Store. Share a
          photo and a few lines about the chai stall, bakery or kirana you grew up with. A person
          reads every memory before it goes up on the{" "}
          <Link href="/wall" className="font-bold text-brand-red underline underline-offset-4">
            Memory Wall
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
