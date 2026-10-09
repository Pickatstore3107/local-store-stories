import type { Metadata } from "next";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = {
  title: "Welcome · Local Stores & Their Stories",
  robots: { index: false, follow: false },
};

export default function WelcomePage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-6 sm:px-5 sm:py-12">
      <WelcomeForm />
    </main>
  );
}
