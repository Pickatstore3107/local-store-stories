import type { Metadata } from "next";
import { RequireAccount } from "@/components/require-account";
import { AccountPanel } from "./account-panel";

export const metadata: Metadata = {
  title: "My account · Local Stores & Their Stories",
};

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-12">
      <RequireAccount>
        <AccountPanel />
      </RequireAccount>
    </main>
  );
}
