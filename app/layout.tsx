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
      default: "Market Memo · AI 美股市場研究",
      template: "%s · Market Memo",
    },
    description:
      "結合市場寬度與 FOMC Hybrid Search 的 AI 美股市場研究工具。",
    openGraph: {
      title: "Market Memo · AI 美股市場研究",
      description:
        "以 keyword 與 semantic hybrid search 檢索十年 FOMC 文件，產生附引用的市場研究回答。",
      type: "website",
      url: origin,
      images: [
        {
          url: `${origin}/og.png`,
          width: 1536,
          height: 1024,
          alt: "Market Memo AI 美股市場研究",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Market Memo · AI 美股市場研究",
      description:
        "以 keyword 與 semantic hybrid search 檢索十年 FOMC 文件，產生附引用的市場研究回答。",
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
