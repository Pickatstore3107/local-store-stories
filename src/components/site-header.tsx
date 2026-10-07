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
      <nav aria-label="Main" className="flex items-center gap-0.5 sm:gap-3">
        <Link
          href="/wall"
          className="rounded-full px-2.5 py-2 text-sm font-bold text-brand-red transition hover:bg-brand-red/5 sm:px-3"
        >
          <span className="sm:hidden">Wall</span>
          <span className="hidden sm:inline">Memory Wall</span>
        </Link>
        <Link
          href="/chain"
          className="rounded-full px-2.5 py-2 text-sm font-bold text-brand-red transition hover:bg-brand-red/5 sm:px-3"
        >
          <span className="sm:hidden">Chain</span>
          <span className="hidden sm:inline">Memory Chain</span>
        </Link>
        {!loading && (
          <Link
            href={user ? "/account" : "/signin"}
            className="ml-1 rounded-full px-3 py-2 text-sm font-bold text-brand-red ring-1 ring-brand-red/30 transition hover:bg-brand-red/5 sm:ml-0 sm:px-4"
          >
            {user ? (
              <>
                <span className="sm:hidden">Account</span>
                <span className="hidden sm:inline">My account</span>
              </>
            ) : (
              "Sign in"
            )}
          </Link>
        )}
      </nav>
    </header>
  );
}
