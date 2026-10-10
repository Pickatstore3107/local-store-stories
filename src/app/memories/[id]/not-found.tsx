import Link from "next/link";
import { primaryButton } from "@/components/ui";

export default function MemoryNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-12 sm:px-5 sm:py-16 text-center">
      <p className="font-hand text-3xl text-ink">This post isn&apos;t here.</p>
      <p className="mt-3 leading-relaxed text-ink-soft">
        The link may be wrong, or the post may have been taken down by the person who
        shared it or by a moderator.
      </p>
      <Link href="/" className={`${primaryButton} mt-8`}>
        Go to Home
      </Link>
    </main>
  );
}
