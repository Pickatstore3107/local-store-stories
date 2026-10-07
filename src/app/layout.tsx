import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local Stores & Their Stories",
  description:
    "Share a memory of the neighbourhood store you never really left. A people-first campaign by Pick at Store.",
};

export const viewport: Viewport = {
  themeColor: "#f6efe3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-serif">{children}</body>
    </html>
  );
}
