"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "./auth-provider";

export function SiteHeader() {
  const { loading, user } = useAuth();

  return (
    <header className="flex items-center justify-between gap-3 px-5 pt-6 sm:px-8">
      <Link href="/" aria-label="Local Stores & Their Stories home">
        <Image
          src="/brand/pas-logo-horizontal.webp"
          alt="Pick at Store"
          width={900}
          height={419}
          priority
          className="h-10 w-auto sm:h-12"
        />
      </Link>
      <nav aria-label="Main" className="flex items-center gap-1 sm:gap-3">
        <Link
          href="/wall"
          className="rounded-full px-3 py-2 text-sm font-bold text-brand-red transition hover:bg-brand-red/5"
        >
          Memory Wall
        </Link>
        {!loading && (
          <Link
            href={user ? "/account" : "/signin"}
            className="rounded-full px-4 py-2 text-sm font-bold text-brand-red ring-1 ring-brand-red/30 transition hover:bg-brand-red/5"
          >
            {user ? "My account" : "Sign in"}
          </Link>
        )}
      </nav>
    </header>
  );
}
