import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "sites.openai.com";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: {
      default: "美股市場寬度儀表板",
      template: "%s · 美股市場寬度儀表板",
    },
    description:
      "每日追蹤 S&P 500、QQQ、MA20 乖離率與等權 Breadth 20。",
    openGraph: {
      title: "美股市場寬度儀表板",
      description:
        "同時觀察 SPX、QQQ 的 MA20 乖離率與各自等權 Breadth 20。",
      type: "website",
      url: origin,
      images: [
        {
          url: `${origin}/og.png`,
          width: 1536,
          height: 1024,
          alt: "美股市場寬度儀表板",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "美股市場寬度儀表板",
      description:
        "同時觀察 SPX、QQQ 的 MA20 乖離率與各自等權 Breadth 20。",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
