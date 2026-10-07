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

// The page someone was trying to open before signing in, so sign-in can
// bring them back to it.
const RETURN_TO = "lss:return-to";

export function returnPath() {
  try {
    return sessionStorage.getItem(RETURN_TO);
  } catch {
    return null;
  }
}

function setReturnPath(path: string | null) {
  try {
    if (path) sessionStorage.setItem(RETURN_TO, path);
    else sessionStorage.removeItem(RETURN_TO);
  } catch {
    // Without storage they land on their account page instead.
  }
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
      if (!exitPath) setReturnPath(window.location.pathname);
      router.replace(exitPath ?? "/signin");
      exitPath = null;
    } else if (!consent) {
      router.replace("/welcome");
    } else {
      setReturnPath(null);
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
