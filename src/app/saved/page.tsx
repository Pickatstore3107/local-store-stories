import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading, RequireAccount } from "@/components/require-account";
import { loadWall } from "@/lib/server/wall";
import { SavedPlaces } from "./saved-places";

export const metadata: Metadata = {
  title: "Saved · Local Stores & Their Stories",
  robots: { index: false, follow: false },
};

async function SavedFromWall() {
  const wall = await loadWall();
  return <SavedPlaces memories={wall?.memories ?? null} />;
}

/** The places someone saved with the bookmark. Only they can see this page. */
export default function SavedPage() {
  return (
    <main style={{ flex: 1, width: "100%", maxWidth: 560, margin: "0 auto" }}>
      <RequireAccount>
        <Suspense fallback={<Loading />}>
          <SavedFromWall />
        </Suspense>
      </RequireAccount>
    </main>
  );
}
