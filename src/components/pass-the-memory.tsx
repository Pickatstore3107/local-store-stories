"use client";

import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { invitePath } from "@/lib/invite-links";
import { friendlyError } from "@/lib/auth-errors";
import { loadInvite, makeInvite, type MemoryInvite } from "@/lib/invites";
import type { Visibility } from "@/lib/stories";
import { primaryButton } from "./ui";

const link = "font-bold text-brand-red underline underline-offset-4";

/** "Priya, Asha and 3 more", with "a friend" for anyone whose name can't be read. */
function names(joined: (string | null)[]) {
  const shown = joined.slice(0, 3).map((name) => name ?? "a friend");
  const more = joined.length - shown.length;
  const list =
    more > 0
      ? `${shown.join(", ")} and ${more} more`
      : shown.length > 1
        ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`
        : shown[0];
  return list.charAt(0).toUpperCase() + list.slice(1);
}

/**
 * "Pass the memory": the memory's invite link, to send to friends on
 * WhatsApp, Instagram or anywhere else. They can pass it on too.
 */
export function PassTheMemory({
  user,
  storyId,
  storeName,
  visibility,
}: {
  user: User;
  storyId: string;
  storeName: string;
  visibility: Visibility;
}) {
  // Undefined while loading, and null until they make the link.
  const [invite, setInvite] = useState<MemoryInvite | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Phones offer their own share sheet; elsewhere, WhatsApp on the web.
  // (Only shown once signed in, so never rendered on the server.)
  const [canShare] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
  );
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));

  useEffect(() => {
    let current = true;
    loadInvite(user, storyId)
      .then((found) => current && setInvite(found))
      .catch((e) => {
        if (!current) return;
        setInvite(null);
        setError(friendlyError(e));
      });
    return () => {
      current = false;
    };
  }, [user, storyId]);

  async function getLink() {
    setError(null);
    setBusy(true);
    try {
      setInvite(await makeInvite(user, storyId, visibility));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const url = invite ? `${origin}${invitePath(invite.code)}` : "";
  const message = `I shared a post about ${storeName} on Local Stores & Their Stories. Which store do you never forget? Share yours here: ${url}`;

  async function send() {
    if (canShare) {
      try {
        await navigator.share({ title: "Pass it on", text: message });
      } catch {
        // They closed the share sheet.
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Copying isn't allowed here. Use Send instead.");
    }
  }

  return (
    <section aria-labelledby={`pass-${storyId}`} className="rounded-2xl bg-brand-yellow/15 p-5">
      <h2 id={`pass-${storyId}`} className="font-hand text-2xl font-bold text-ink">
        Pass it on
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Send your invite link to friends so they can share a store they never forgot, and they
        can pass it on too. You&apos;ll see everyone who joins through it, and they&apos;ll
        follow you.
        {visibility === "link" &&
          " Anyone with the link can also see this post, even though it isn't on Home."}
      </p>

      {invite === undefined ? (
        <p className="mt-4 text-sm text-ink-soft" role="status">
          Loading…
        </p>
      ) : invite === null ? (
        <button type="button" onClick={getLink} disabled={busy} className={`${primaryButton} mt-4`}>
          {busy ? "Making your link…" : "Get my invite link"}
        </button>
      ) : (
        <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-ink/5">
          <p id={`link-${storyId}`} className="font-bold text-ink">
            Your invite link
          </p>
          <p aria-labelledby={`link-${storyId}`} className="mt-1 select-all break-all text-ink">
            {url}
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            <button type="button" onClick={send} className={link}>
              {canShare ? "Send" : "Send on WhatsApp"}
            </button>
            <button type="button" onClick={copy} className={link}>
              {copied ? "Link copied" : "Copy link"}
            </button>
          </p>
          {invite.joined && (
            <p className={`mt-3 ${invite.joined.length ? "text-emerald-900" : "text-ink-soft"}`}>
              {invite.joined.length
                ? `${names(invite.joined)} joined through your link.`
                : "No one has joined through it yet."}
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
    </section>
  );
}
