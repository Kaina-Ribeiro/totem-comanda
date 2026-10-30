import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";

import { OfflineOverlay } from "@/components/offline/offline-overlay";

import "./globals.css";

// Variable fonts: Fraunces covers weights 500-600 and the italic brand name,
// with the optical-size axis the prototype uses (opsz 9..144).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Comanda",
  applicationName: "Comanda",
};

export const viewport: Viewport = {
  themeColor: "#4e3426",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${fraunces.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SerwistProvider swUrl="/serwist/sw.js">
          {children}
          <OfflineOverlay />
        </SerwistProvider>
      </body>
    </html>
  );
}
