import type { Metadata } from "next";
import { RequireAccount } from "@/components/require-account";
import { ActivityList } from "./activity-list";

export const metadata: Metadata = {
  title: "Activity · Local Stores & Their Stories",
};

export default function ActivityPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6 sm:px-5 sm:py-12">
      <RequireAccount>
        <ActivityList />
      </RequireAccount>
    </main>
  );
}
