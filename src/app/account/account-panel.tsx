"use client";

import { signOut } from "firebase/auth";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { setExitPath } from "@/components/require-account";
import { card, input, primaryButton, secondaryButton } from "@/components/ui";
import {
  CITY_MAX,
  CITY_MIN,
  NAME_MAX,
  deleteAccount,
  signedInRecently,
  updateProfile,
} from "@/lib/account";
import { friendlyError } from "@/lib/auth-errors";
import { getFirebase } from "@/lib/firebase";
import { ModeratorCard } from "./moderator-card";
import { MyStories } from "./my-stories";

// Set before asking someone to sign in again, so the delete step reopens after.
const PENDING_DELETE = "lss:pending-delete";

function hasPendingDelete() {
  try {
    return sessionStorage.getItem(PENDING_DELETE) === "1";
  } catch {
    return false;
  }
}

function clearPendingDelete() {
  try {
    sessionStorage.removeItem(PENDING_DELETE);
  } catch {
    // Nothing to clear.
  }
}

export function AccountPanel() {
  const { user, profile, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(hasPendingDelete);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(clearPendingDelete, []);

  if (!user || !profile) return null;
  const signedInWith = user.email ?? "your Google account";

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    const name = displayName.trim();
    const place = city.trim();
    if (!name || name.length > NAME_MAX || place.length < CITY_MIN || place.length > CITY_MAX) {
      setError("Please enter a name and a city.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await updateProfile(user.uid, { displayName: name, city: place });
      await refresh();
      setEditing(false);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function signOutNow() {
    setExitPath("/");
    await signOut(getFirebase().auth);
  }

  async function reauthenticateToDelete() {
    try {
      sessionStorage.setItem(PENDING_DELETE, "1");
    } catch {
      // Without storage they just open the delete step again after signing in.
    }
    setExitPath("/signin");
    await signOut(getFirebase().auth);
  }

  async function deleteEverything() {
    if (!user) return;
    setError(null);
    setBusy(true);
    try {
      setExitPath("/");
      await deleteAccount(user);
    } catch (e) {
      setExitPath(null);
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className={card}>
        <h1 className="text-2xl font-extrabold text-brand-red">My account</h1>

        <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-ink-soft">
          Shown publicly
        </h2>
        {editing ? (
          <form onSubmit={save} noValidate className="mt-3">
            <label htmlFor="displayName" className="block text-sm font-bold text-ink">
              Name
            </label>
            <input
              id="displayName"
              value={displayName}
              maxLength={NAME_MAX}
              onChange={(e) => setDisplayName(e.target.value)}
              className={`${input} mt-2`}
            />
            <label htmlFor="city" className="mt-4 block text-sm font-bold text-ink">
              City
            </label>
            <input
              id="city"
              value={city}
              maxLength={CITY_MAX}
              onChange={(e) => setCity(e.target.value)}
              className={`${input} mt-2`}
            />
            <div className="mt-4 flex gap-3">
              <button type="submit" disabled={busy} className={primaryButton}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDisplayName(profile.displayName);
                  setCity(profile.city);
                }}
                className={secondaryButton}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-3 flex items-start justify-between gap-4">
            <dl>
              <dt className="sr-only">Name</dt>
              <dd className="text-lg font-bold text-ink">{profile.displayName}</dd>
              <dt className="sr-only">City</dt>
              <dd className="text-ink-soft">{profile.city}</dd>
            </dl>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm font-bold text-brand-red underline underline-offset-4"
            >
              Edit
            </button>
          </div>
        )}

        <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-ink-soft">
          Private, only you can see this
        </h2>
        <p className="mt-2 text-ink">Signed in with {signedInWith}</p>

        <button type="button" onClick={signOutNow} className={`${secondaryButton} mt-6`}>
          Sign out
        </button>
      </section>

      <ModeratorCard user={user} />

      <MyStories user={user} />

      <section className={card}>
        <h2 className="text-lg font-extrabold text-ink">Delete my account</h2>
        <p className="mt-2 text-sm text-ink-soft">
          This permanently removes your profile, your memories and photos, your consent
          record and your sign-in. It cannot be undone.
        </p>
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="mt-4 text-sm font-bold text-brand-red underline underline-offset-4"
          >
            I want to delete my account
          </button>
        ) : signedInRecently(user) ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={deleteEverything} disabled={busy} className={primaryButton}>
              {busy ? "Deleting…" : "Yes, delete everything"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className={secondaryButton}
            >
              Keep my account
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-ink">
              For your safety, please sign in again to confirm it&apos;s you. We&apos;ll bring
              you straight back here.
            </p>
            <button
              type="button"
              onClick={reauthenticateToDelete}
              className={`${primaryButton} mt-3`}
            >
              Sign in again
            </button>
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-deep">
          {error}
        </p>
      )}
    </div>
  );
}
