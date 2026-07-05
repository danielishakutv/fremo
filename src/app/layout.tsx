import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fremo — Watch the latest. Download in seconds.",
  description:
    "Fremo is the fastest, cleanest way to discover and download the newest movies and series. Search, preview and grab your film in one tap.",
  keywords: ["movies", "download", "free movies", "fremo", "stream", "series"],
  openGraph: {
    title: "Fremo — Fast movie search & download",
    description: "Discover and download the latest movies in seconds.",
    type: "website",
  },
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23f43f5e'/%3E%3Cpath d='M12 9l11 7-11 7z' fill='white'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  themeColor: "#07070b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-aurora min-h-screen font-sans antialiased selection:bg-brand-500/40">
        {children}
      </body>
    </html>
  );
}
