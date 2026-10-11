"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModeratorRow, rowStyle } from "./moderator-card";
import { MyStories } from "./my-stories";

/**
 * Only on your own profile, the prototype's two rows: Manage my posts,
 * which opens every post you shared with its review and invite link, and
 * the review queue for moderators.
 */
export function OwnerSection({ uid }: { uid: string }) {
  const { user, consent } = useAuth();
  const [managing, setManaging] = useState(false);
  if (!user || !consent || user.uid !== uid) return null;
  return (
    <div style={{ padding: "20px 18px 0", display: "flex", flexDirection: "column", gap: 2 }}>
      <button type="button" aria-expanded={managing} onClick={() => setManaging(!managing)} style={rowStyle}>
        Manage my posts<span style={{ color: "#6E5A55", transform: managing ? "rotate(90deg)" : "none", transition: "transform .2s" }}>›</span>
      </button>
      {managing && (
        <div style={{ paddingBottom: 14 }}>
          <MyStories user={user} />
        </div>
      )}
      <ModeratorRow user={user} />
    </div>
  );
}
