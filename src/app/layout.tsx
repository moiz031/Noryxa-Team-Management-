import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "NORYXA",
  url: siteUrl,
  logo: `${siteUrl}/noryxa-logo.svg`,
  sameAs: [
    "https://twitter.com/noryxa",
    "https://linkedin.com/company/noryxa",
    "https://github.com/noryxa",
  ],
  description: "Intelligent operating system for AI Automation, Digital Marketing, eCommerce, Software & Growth.",
};

export const viewport: Viewport = {
  themeColor: "#07090D",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NORYXA — Agency Command Center",
    template: "%s | NORYXA",
  },
  description: "Intelligent operating system for AI Automation, Digital Marketing, eCommerce, Software & Growth.",
  applicationName: "NORYXA Agency Command Center",
  keywords: ["agency management", "team management", "digital agency operations", "project management", "task management", "employee management"],
  authors: [{ name: "NORYXA" }],
  creator: "NORYXA",
  publisher: "NORYXA",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": ["/rss.xml"],
    },
  },
  openGraph: {
    type: "website",
    siteName: "NORYXA",
    title: "NORYXA — Agency Command Center",
    description: "One operating system for agency people, projects, deliverables and growth.",
    url: "/",
    locale: "en_US",
    images: [
      {
        url: "/noryxa-logo.svg",
        width: 180,
        height: 68,
        alt: "NORYXA Agency Command Center",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NORYXA — Agency Command Center",
    description: "One operating system for agency people, projects, deliverables and growth.",
    images: ["/noryxa-logo.svg"],
    creator: "@noryxa",
  },
  other: {
    "script:ld+json": JSON.stringify(organizationJsonLd),
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-[#07090D] text-[#F5F7FA] selection:bg-[#39FF14]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
