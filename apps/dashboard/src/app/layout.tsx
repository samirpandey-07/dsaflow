import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import SWBypass from "../components/SWBypass";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "DSAFlow | Master Data Structures & Algorithms",
  description: "Track your DSA progress, manage revision cycles with spaced repetition, and get intelligent insights for your code. The ultimate companion for competitive programmers.",
  keywords: ["DSA", "Data Structures", "Algorithms", "Competitive Programming", "LeetCode Tracker", "Spaced Repetition", "Coding Interview Prep"],
  authors: [{ name: "Samir Pandey" }],
  openGraph: {
    title: "DSAFlow | Master Data Structures & Algorithms",
    description: "The ultimate companion for competitive programmers to track and revise problems efficiently.",
    url: "https://github.com/samirpandey-07/dsaflow",
    siteName: "DSAFlow",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DSAFlow",
    description: "Track your DSA progress and master coding interviews.",
  },
};

import Providers from "./providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${outfit.variable} font-inter antialiased bg-background text-foreground`}
      >
        <SWBypass />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
