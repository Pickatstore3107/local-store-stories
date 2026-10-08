import Link from "next/link";
import { primaryButton } from "@/components/ui";

export default function PersonNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-12 sm:px-5 sm:py-16 text-center">
      <p className="font-hand text-3xl text-ink">This person isn&apos;t here.</p>
      <p className="mt-3 leading-relaxed text-ink-soft">
        The link may be wrong, or they may have deleted their account.
      </p>
      <Link href="/" className={`${primaryButton} mt-8`}>
        Go to Home
      </Link>
    </main>
  );
}
