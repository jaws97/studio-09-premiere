import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const display = Big_Shoulders({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
});

const serif = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Studio 09 · The Premiere",
  description: "Opening night. One season. The whole cast gets top billing.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#120c0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
