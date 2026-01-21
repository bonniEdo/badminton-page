import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Badminton-Rehab",
  description: "戒球日誌 · 在這裡，膩了，就是唯一的解藥。",
  openGraph: {
    title: "Badminton-Rehab",
    description: "戒球日誌 · 記錄每一場球局",
    url: "https://badminton-rehab.vercel.app/",
    siteName: "Badminton-Rehab",
    images: [
      {
        url: "https://badminton-rehab.vercel.app/og.png",
        width: 1200,
        height: 630,
        alt: "Badminton-Rehab",
      },
    ],
    type: "website",
  },
};
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
        {children}
      </body>
    </html>
  );
}
