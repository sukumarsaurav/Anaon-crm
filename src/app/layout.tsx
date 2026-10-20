import type { Metadata } from "next";
import { Manrope, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import UIProvider from "@/components/ui/UIProvider";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Hindi script fallback — composed onto the same elements via the CSS stack.
// Not preloaded: the UI is English, and the unicode-range means a weight is only fetched when
// Devanagari text is actually on screen. Preloading cost 4 font requests on every page.
const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

export const metadata: Metadata = {
  // Pages set their own title; every tab used to read "ANON INDIA CRM".
  title: { template: "%s · ANON CRM", default: "ANON INDIA CRM" },
  description: "Real Estate CRM for ANON INDIA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${notoDevanagari.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <UIProvider>{children}</UIProvider>
      </body>
    </html>
  );
}
