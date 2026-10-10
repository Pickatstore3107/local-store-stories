"use client";

import Link from "next/link";
import { useAuth } from "../auth-provider";
import { BookmarkIcon } from "../icons";
import { setReturnPath } from "../require-account";
import { useSave } from "../use-saved";

/**
 * The bookmark that saves a memory to Saved, for the person alone. Visitors
 * who tap it are asked to sign in, for a few seconds, at the bottom of the
 * screen.
 */
export function SaveButton({
  storyId,
  storeName,
  className = "",
  iconClassName = "h-[1.6rem] w-[1.6rem]",
}: {
  storyId: string;
  storeName: string;
  className?: string;
  iconClassName?: string;
}) {
  const { user } = useAuth();
  const state = useSave(storyId);
  return (
    <>
      <button
        type="button"
        onClick={state.toggle}
        aria-pressed={state.saved === true}
        disabled={state.busy}
        title={state.error ?? undefined}
        className={className}
      >
        <BookmarkIcon filled={!!state.saved} className={iconClassName} />
        <span className="sr-only">Save {storeName}</span>
      </button>
      {state.askSignIn && (
        <Link
          href={user ? "/welcome" : "/signin"}
          onClick={() => setReturnPath(window.location.pathname)}
          role="status"
          className="fixed inset-x-4 bottom-[calc(var(--bar-h)+var(--bar-lift)+1rem)] z-50 mx-auto max-w-sm rounded-2xl bg-ink px-4 py-3 text-center text-sm font-bold text-white shadow-[0_10px_30px_rgb(43_29_26/0.35)] sm:bottom-6"
        >
          {user ? "Finish joining to save places" : "Sign in to save places"}
        </Link>
      )}
    </>
  );
}
