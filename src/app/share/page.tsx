import type { Metadata } from "next";
import { RequireAccount } from "@/components/require-account";
import { ShareForm } from "./share-form";

export const metadata: Metadata = {
  title: "Share a memory · Local Stores & Their Stories",
};

export default function SharePage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-12">
      <RequireAccount>
        <ShareForm />
      </RequireAccount>
    </main>
  );
}
