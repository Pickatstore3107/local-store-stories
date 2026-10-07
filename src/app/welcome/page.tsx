import type { Metadata } from "next";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = {
  title: "Welcome · Local Stores & Their Stories",
};

export default function WelcomePage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-12">
      <WelcomeForm />
    </main>
  );
}
