import type { Metadata } from "next";
import { RequireAccount } from "@/components/require-account";
import { ActivityList } from "./activity-list";

export const metadata: Metadata = {
  title: "Activity · Local Stores & Their Stories",
  robots: { index: false, follow: false },
};

export default function ActivityPage() {
  return (
    <main style={{ flex: 1, width: "100%", maxWidth: 560, margin: "0 auto" }}>
      <RequireAccount>
        <ActivityList />
      </RequireAccount>
    </main>
  );
}
