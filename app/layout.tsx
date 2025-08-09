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

export const metadata = {
  title: "GeniusTripAI – Smart AI Travel Planner",
  description: "Plan multi-destination trips with AI…",
  icons: {
    icon: [
      { url: "/icon.png?v=7", type: "image/png", sizes: "512x512" }, // app/icon.png
      { url: "/favicon.ico?v=7", type: "image/x-icon" },             // public/favicon.ico
    ],
    shortcut: "/favicon.ico?v=7",
    apple: "/icon.png?v=7",
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
