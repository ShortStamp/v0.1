import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShortStamp — Is it real?",
  description:
    "AI-powered desktop overlay that checks facts, detects AI-generated content, identifies scam links, and flags misinformation in real time.",
  keywords: [
    "fact check",
    "AI detection",
    "scam detection",
    "misinformation",
    "desktop app",
  ],
  openGraph: {
    title: "ShortStamp — Is it real?",
    description:
      "AI-powered desktop overlay that checks the legitimacy of anything on your screen.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-black antialiased">{children}</body>
    </html>
  );
}
