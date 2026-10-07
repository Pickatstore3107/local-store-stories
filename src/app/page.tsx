import Link from "next/link";
import { primaryButton } from "@/components/ui";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-ink-soft">
        Pick at Store presents
      </p>
      <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight text-brand-red sm:text-6xl">
        Local Stores &amp; Their Stories
      </h1>
      <p className="mt-6 max-w-xl text-xl font-semibold text-ink sm:text-2xl">
        Some places never leave us.
      </p>
      <div
        className="mt-10 h-1.5 w-24 rounded-full bg-brand-yellow"
        aria-hidden="true"
      />
      <p className="mt-10 max-w-md text-base leading-relaxed text-ink-soft">
        The chai stall outside school, the bakery that smelled of Sunday, the
        kirana that kept your family&apos;s tab. Soon you can pin yours to the
        map of India and pass the memory on.
      </p>
      <Link href="/signin" className={`${primaryButton} mt-12`}>
        Join the campaign
      </Link>
      <p className="mt-4 text-sm text-ink-soft">
        Sharing stories opens soon. Join now to be among the first.
      </p>
    </main>
  );
}
