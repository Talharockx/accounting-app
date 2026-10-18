import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MadeByCredit } from "@/components/layout/made-by-credit";
import { AppProviders } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LedgerView | Accounting Dashboard",
  description:
    "Professional accounting dashboard built with Next.js, TypeScript, and Tailwind CSS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      data-theme="midnight"
    >
      <body className="flex min-h-full flex-col bg-[var(--background)] font-sans text-[var(--foreground)] antialiased">
        <AppProviders>
          <div className="flex min-h-full flex-1 flex-col">
            <div className="flex-1">{children}</div>
            <MadeByCredit />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
