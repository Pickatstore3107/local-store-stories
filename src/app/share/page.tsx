import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading, RequireAccount } from "@/components/require-account";
import { ShareForm } from "./share-form";

export const metadata: Metadata = {
  title: "Share a post · Local Stores & Their Stories",
  description:
    "Tell the story of a neighbourhood store you remember, with a photo, and put it on the Hyderabad map.",
  alternates: { canonical: "/share" },
  openGraph: {
    title: "Share a post",
    description:
      "Tell the story of a neighbourhood store you remember, with a photo, and put it on the Hyderabad map.",
  },
};

export default function SharePage() {
  return (
    <main style={{ flex: 1, width: "100%", maxWidth: 560, margin: "0 auto" }}>
      <RequireAccount>
        {/* The address can name a store to fill in, so it's read in the browser. */}
        <Suspense fallback={<Loading />}>
          <ShareForm />
        </Suspense>
      </RequireAccount>
    </main>
  );
}
