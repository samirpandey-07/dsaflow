import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SWBypass from "../components/SWBypass";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DSAFlow | Master Your Data Structures & Algorithms",
  description: "Track your DSA progress, manage revision cycles with spaced repetition, and get intelligent insights for your code. The ultimate companion for competitive programmers.",
  keywords: ["DSA", "Data Structures", "Algorithms", "Competitive Programming", "LeetCode Tracker", "Spaced Repetition", "Coding Interview Prep"],
  authors: [{ name: "Samir Pandey" }],
  openGraph: {
    title: "DSAFlow | Master Your Data Structures & Algorithms",
    description: "The ultimate companion for competitive programmers to track and revise problems efficiently.",
    url: "https://github.com/samirpandey-07/dsaflow",
    siteName: "DSAFlow",
    images: [
      {
        url: "/og-image.png", // User would need to add this asset later
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SWBypass />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
