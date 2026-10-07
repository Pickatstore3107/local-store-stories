"use client";

import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { invitePath } from "@/lib/chain";
import { friendlyError } from "@/lib/auth-errors";
import { INVITES_PER_MEMORY, loadInvites, makeInvites, type MyInvite } from "@/lib/invites";
import type { Visibility } from "@/lib/stories";
import { primaryButton } from "./ui";

const link = "font-bold text-brand-red underline underline-offset-4";

/**
 * "Pass the memory": the three personal invite links that come with each
 * memory, to send to friends on WhatsApp, Instagram or anywhere else.
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
  const [invites, setInvites] = useState<MyInvite[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Phones offer their own share sheet; elsewhere, WhatsApp on the web.
  // (Only shown once signed in, so never rendered on the server.)
  const [canShare] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
  );

  useEffect(() => {
    let current = true;
    loadInvites(user, storyId)
      .then((list) => current && setInvites(list))
      .catch((e) => {
        if (!current) return;
        setInvites([]);
        setError(friendlyError(e));
      });
    return () => {
      current = false;
    };
  }, [user, storyId]);

  async function getLinks() {
    setError(null);
    setBusy(true);
    try {
      setInvites(await makeInvites(user, storyId, visibility));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  function message(url: string) {
    return `I shared a memory of ${storeName} on Local Stores & Their Stories. This invite is just for you: which store do you never forget? ${url}`;
  }

  async function send(code: string) {
    const url = `${window.location.origin}${invitePath(code)}`;
    if (canShare) {
      try {
        await navigator.share({ title: "Pass the memory", text: message(url) });
      } catch {
        // They closed the share sheet.
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message(url))}`, "_blank", "noopener");
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${invitePath(code)}`);
      setCopied(code);
    } catch {
      setError("Copying isn't allowed here. Use Send instead.");
    }
  }

  return (
    <section aria-labelledby={`pass-${storyId}`} className="rounded-2xl bg-brand-yellow/15 p-5">
      <h2 id={`pass-${storyId}`} className="font-hand text-2xl font-bold text-ink">
        Pass the memory
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Send {INVITES_PER_MEMORY} friends a personal link to share a store they never forgot.
        Each link works once. When a friend joins through yours, the Memory Chain shows that
        you passed the memory on.
      </p>

      {invites === null ? (
        <p className="mt-4 text-sm text-ink-soft" role="status">
          Loading…
        </p>
      ) : invites.length === 0 ? (
        <button type="button" onClick={getLinks} disabled={busy} className={`${primaryButton} mt-4`}>
          {busy ? "Making your links…" : `Get my ${INVITES_PER_MEMORY} invite links`}
        </button>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {invites.map((invite, i) => (
            <li
              key={invite.code}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-ink/5"
            >
              <span className="font-bold text-ink">Invite {i + 1}</span>
              {invite.joined ? (
                <span className="text-emerald-900">
                  ✓ {invite.joined.name ? `${invite.joined.name} joined` : "A friend joined"}
                </span>
              ) : (
                <span className="flex gap-4">
                  <button type="button" onClick={() => send(invite.code)} className={link}>
                    {canShare ? "Send" : "Send on WhatsApp"}
                  </button>
                  <button type="button" onClick={() => copy(invite.code)} className={link}>
                    {copied === invite.code ? "Link copied" : "Copy link"}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
    </section>
  );
}
