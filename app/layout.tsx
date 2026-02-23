import type { Metadata, Viewport } from "next";
import { Noto_Serif_TC } from "next/font/google";
import "./globals.css";
import AuthWatcher from "./AuthWatcher";
import LiffProvider from './LiffProvider';
import ServiceWorkerRegister from './components/ServiceWorkerRegister';
import InstallPrompt from './components/InstallPrompt';

const notoSerifTC = Noto_Serif_TC({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-serif",
});

export const viewport: Viewport = {
  themeColor: "#8A9A5B",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://badminton-rehab.vercel.app"),
  title: "Badminton-Rehab",
  description: "戒球日誌 · 在這裡，膩了，就是唯一的解藥。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "戒球日誌",
  },
  openGraph: {
    title: "Badminton-Rehab",
    description: "救命啊 好想打球",
    url: "https://badminton-rehab.vercel.app/",
    siteName: "Badminton-Rehab-Center",
    images: [
      {
        url: "https://badminton-rehab.vercel.app/og.png",
        secureUrl: "https://badminton-rehab.vercel.app/og.png",
        width: 1200,
        height: 630,
        alt: "Badminton-Rehab",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Badminton-Rehab",
    description: "救命啊 好想打球",
    images: ["https://badminton-rehab.vercel.app/og.png"],
  },
};


export default function RootLayout({  children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
  return (
    <html lang="zh-Hant">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${notoSerifTC.variable} antialiased`}>
        <ServiceWorkerRegister />
        <InstallPrompt />
        <LiffProvider>
          <AuthWatcher>
            {children}
          </AuthWatcher>
        </LiffProvider>
      </body>
    </html>
  );
}