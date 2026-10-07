"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./auth-provider";

// Where to go when someone deliberately signs out or deletes their account,
// instead of the default trip to the sign-in screen.
let exitPath: string | null = null;

export function setExitPath(path: string | null) {
  exitPath = path;
}

/**
 * Shows its children only to signed-in people who have given consent.
 * Everyone else is sent to sign in, or to the welcome screen to consent.
 */
export function RequireAccount({ children }: { children: ReactNode }) {
  const { loading, user, consent } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(exitPath ?? "/signin");
      exitPath = null;
    } else if (!consent) {
      router.replace("/welcome");
    }
  }, [loading, user, consent, router]);

  if (loading || !user || !consent) return <Loading />;
  return children;
}

export function Loading() {
  return (
    <p className="py-24 text-center text-ink-soft" role="status">
      Loading…
    </p>
  );
}
