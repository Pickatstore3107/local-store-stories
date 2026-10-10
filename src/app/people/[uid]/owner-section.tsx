"use client";

import { useAuth } from "@/components/auth-provider";
import { ModeratorCard } from "./moderator-card";
import { MyStories } from "./my-stories";

/**
 * Only on your own profile: the review queue for moderators, and every
 * memory you shared, with its review and its invite link.
 */
export function OwnerSection({ uid }: { uid: string }) {
  const { user, consent } = useAuth();
  if (!user || !consent || user.uid !== uid) return null;
  return (
    <div className="mt-8 flex flex-col gap-4">
      <ModeratorCard user={user} />
      <MyStories user={user} />
    </div>
  );
}
