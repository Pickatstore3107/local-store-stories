"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { FollowButton } from "@/components/follow-button";
import { sharePost } from "@/components/pas/actions";
import { setReturnPath } from "@/components/require-account";
import { useMyFollows } from "@/components/use-my-follows";
import { friendlyError } from "@/lib/auth-errors";
import { block } from "@/lib/follows";
import { personPath } from "@/lib/people";
import { ReportProfileForm } from "./report-profile";

const button = { height: 40, border: 0, borderRadius: 999, background: "#F7F2EF", font: "700 13px 'Plus Jakarta Sans'", color: "#2B1D1A", display: "grid", placeItems: "center" } as const;
const note = { gridColumn: "1 / -1", margin: 0, font: "500 12px/1.5 'Plus Jakarta Sans'", color: "#6E5A55" } as const;
const quiet = { padding: 0, border: 0, background: "transparent", font: "600 11.5px 'Plus Jakarta Sans'", color: "#6E5A55" } as const;
const row = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "14px 18px 0" } as const;

/**
 * The prototype's two buttons: Edit profile and Invite friends on your own
 * profile; Follow and Share on someone else's, with Block and Report under.
 */
export function ProfileActions({ uid, name }: { uid: string; name: string }) {
  const { loading, user, consent } = useAuth();
  const { blocked } = useMyFollows();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back from signing in to follow them, so sign-in shouldn't bring them here again.
  useEffect(() => {
    if (user && consent) setReturnPath(null);
  }, [user, consent]);

  if (loading) return <div style={{ ...row, height: 54 }} />;

  if (user?.uid === uid) {
    return (
      <div style={row}>
        <Link href="/account" style={button}>Edit profile</Link>
        <button type="button" onClick={() => sharePost(personPath(uid), `${name} on Local Stores & Their Stories`)} style={button}>Invite friends</button>
        <p style={note}>Anyone can see your profile, your followers and who you follow.</p>
      </div>
    );
  }

  const member = user && consent ? user : null;
  const isBlocked = blocked.has(uid);

  async function blockThem() {
    if (!member) return;
    setError(null);
    setBusy(true);
    try {
      await block(member, uid);
      setConfirming(false);
      router.refresh(); // the follower counts
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={row}>
      <FollowButton uid={uid} name={name} pas />
      <button type="button" onClick={() => sharePost(personPath(uid), `${name} on Local Stores & Their Stories`)} style={button}>Share</button>
      <p style={note}>
        {isBlocked
          ? `You blocked ${name}. They can't follow you, and they weren't told.`
          : "Anyone can see who you follow."}
      </p>
      {member && !confirming && !reporting && (
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 14 }}>
          {!isBlocked && (
            <button type="button" onClick={() => setConfirming(true)} style={quiet}>
              Block
            </button>
          )}
          <button type="button" onClick={() => setReporting(true)} style={quiet}>
            Report
          </button>
        </div>
      )}
      {member && reporting && (
        <div style={{ gridColumn: "1 / -1" }}>
          <ReportProfileForm uid={uid} name={name} onClose={() => setReporting(false)} />
        </div>
      )}
      {member && !isBlocked && confirming && (
        <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, font: "500 13px/1.45 'Plus Jakarta Sans'", color: "#2B1D1A" }}>
            <b>Block {name}?</b> You&apos;ll stop following each other, and they won&apos;t be able to follow you. They won&apos;t be told.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button type="button" onClick={blockThem} disabled={busy} style={{ ...button, background: "#A3171B", color: "#fff" }}>
              {busy ? "Blocking…" : "Block"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} style={button}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" style={{ ...note, color: "#7D1114" }}>
          {error}
        </p>
      )}
    </div>
  );
}
