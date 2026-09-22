import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#07090D",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "NORYXA — Agency Command Center",
  description: "Intelligent operating system for AI Automation, Digital Marketing, eCommerce, Software & Growth.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="min-h-screen bg-[#07090D] text-[#F5F7FA] selection:bg-[#39FF14]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
