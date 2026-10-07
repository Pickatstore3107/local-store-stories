import type { Metadata } from "next";
import { RequireAccount } from "@/components/require-account";
import { ModerationPanel } from "./moderation-panel";

export const metadata: Metadata = {
  title: "Review memories · Local Stores & Their Stories",
};

export default function ModeratePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-12">
      <RequireAccount>
        <ModerationPanel />
      </RequireAccount>
    </main>
  );
}
