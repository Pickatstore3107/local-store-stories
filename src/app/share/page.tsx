import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading, RequireAccount } from "@/components/require-account";
import { ShareForm } from "./share-form";

export const metadata: Metadata = {
  title: "Share a memory · Local Stores & Their Stories",
};

export default function SharePage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6 sm:px-5 sm:py-12">
      <RequireAccount>
        {/* The address can name a store to fill in, so it's read in the browser. */}
        <Suspense fallback={<Loading />}>
          <ShareForm />
        </Suspense>
      </RequireAccount>
    </main>
  );
}
