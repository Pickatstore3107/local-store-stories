import type { Metadata, Viewport } from "next";
import { Kalam, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { BottomBar } from "@/components/bottom-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// A clean, modern sans for everything but the memories themselves.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

// Handwriting for the memories themselves, in Hindi and English.
const kalam = Kalam({
  variable: "--font-kalam",
  weight: ["400", "700"],
  subsets: ["latin", "devanagari"],
});

export const metadata: Metadata = {
  title: "Local Stores & Their Stories",
  description:
    "Share a memory of the neighbourhood store you never really left. A people-first campaign by Pick at Store.",
};

export const viewport: Viewport = {
  themeColor: "#a3171b",
  // Lets the bottom bar sit clear of the iPhone's home bar.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${kalam.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-(--bar-h) font-sans">
        <AuthProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
          <BottomBar />
        </AuthProvider>
      </body>
    </html>
  );
}
