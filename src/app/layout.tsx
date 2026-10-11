import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Kalam, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { BottomBar } from "@/components/bottom-bar";
import { CookieBanner } from "@/components/cookie-choice";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Splash, splashScript } from "@/components/splash";
import { anton } from "@/lib/anton";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

// The redesign's fonts (docs/design_handoff_pas_redesign): Plus Jakarta Sans
// 400 to 700 for the interface, Playfair Display 500 and 600 with italics for
// headings, Kalam 400 for handwritten words and Anton 400 (src/lib/anton.ts)
// for years and numbers. Google serves Jakarta and Playfair as variable fonts,
// as the prototype gets them.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const kalam = Kalam({
  variable: "--font-kalam",
  weight: "400",
  subsets: ["latin", "devanagari"],
});

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#a3171b",
  // Lets the bottom bar sit clear of the iPhone's home bar.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${playfair.variable} ${kalam.variable} ${anton.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {/* Decides before the first paint whether the opening screen shows. */}
        <Script id="lss-splash" strategy="beforeInteractive">
          {splashScript}
        </Script>
        <AuthProvider>
          <Splash />
          {/* The prototype's phone screen: white on its #EFEAE6 page. */}
          <div className="flex flex-col pb-[calc(var(--bar-h)+var(--bar-lift))]" style={{ flex: 1, background: "#fff" }}>
            <SiteHeader />
            {children}
            <SiteFooter />
          </div>
          <BottomBar />
          <CookieBanner />
        </AuthProvider>
        {/* Counts visits without cookies or anything that identifies a person. */}
        <Analytics />
      </body>
    </html>
  );
}
