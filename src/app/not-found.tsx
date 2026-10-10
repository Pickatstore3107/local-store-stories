import type { Metadata } from "next";
import Link from "next/link";
import { primaryButton, secondaryButton } from "@/components/ui";
import { Illustration } from "@/components/illustration";

export const metadata: Metadata = {
  title: "Page not found · Local Stores & Their Stories",
  robots: { index: false, follow: false },
};

/** Any address that doesn't exist on the site. */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-12 text-center sm:px-5 sm:py-16">
      <Illustration name="lost" />
      <p className="mt-4 text-sm font-bold uppercase tracking-wide text-brand-red">Page not found</p>
      <h1 className="mt-2 font-hand text-3xl text-ink sm:text-4xl">This page isn&apos;t here.</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        The link may be mistyped, or the page may have moved. The posts are all on Home and
        on the map.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={primaryButton}>
          Go to Home
        </Link>
        <Link href="/map" className={secondaryButton}>
          Open the map
        </Link>
      </div>
    </main>
  );
}
