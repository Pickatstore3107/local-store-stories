import type { Metadata } from "next";
import { RequireAccount } from "@/components/require-account";
import { ModerationPanel } from "./moderation-panel";

export const metadata: Metadata = {
  title: "Review memories · Local Stores & Their Stories",
  robots: { index: false, follow: false },
};

export default function ModeratePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-5 sm:py-12">
      <RequireAccount>
        <ModerationPanel />
      </RequireAccount>
    </main>
  );
}
