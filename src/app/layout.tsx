import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import Link from "next/link";
import { AuthProvider } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// Rounded sans that sits close to the Pick at Store wordmark.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Local Stores & Their Stories",
  description:
    "Share a memory of the neighbourhood store you never really left. A people-first campaign by Pick at Store.",
};

export const viewport: Viewport = {
  themeColor: "#a3171b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          <SiteHeader />
          {children}
          <footer className="px-6 py-8 text-center text-sm text-ink-soft">
            <Link href="/privacy" className="underline underline-offset-4">
              Privacy
            </Link>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
