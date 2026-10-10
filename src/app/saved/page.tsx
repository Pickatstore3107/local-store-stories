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
  return <SavedPlaces memories={wall?.memories ?? null} builtAt={wall?.builtAt ?? 0} />;
}

/** The places someone saved with the bookmark. Only they can see this page. */
export default function SavedPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-6 sm:px-5 sm:py-12">
      <RequireAccount>
        <Suspense fallback={<Loading />}>
          <SavedFromWall />
        </Suspense>
      </RequireAccount>
    </main>
  );
}
