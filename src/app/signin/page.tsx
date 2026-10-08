import type { Metadata } from "next";
import { SignInForm } from "./signin-form";

export const metadata: Metadata = {
  title: "Sign in · Local Stores & Their Stories",
};

export default function SignInPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-6 sm:px-5 sm:py-12">
      <SignInForm />
    </main>
  );
}
