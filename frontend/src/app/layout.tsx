import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "ShortStamp — Discover Trending Beauty",
  description:
    "Find trending makeup styles, match them to your face, and compare prices across retailers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: "light" }}>
      <body>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
