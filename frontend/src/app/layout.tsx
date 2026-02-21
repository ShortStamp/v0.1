import type { Metadata } from "next";
<<<<<<< Updated upstream
=======
import { Libre_Baskerville, Montserrat } from "next/font/google";
>>>>>>> Stashed changes
import "./globals.css";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";

<<<<<<< Updated upstream
=======
const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-libre-baskerville",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    <html lang="en" style={{ colorScheme: "light" }}>
=======
    <html lang="en" style={{ colorScheme: "light" }} className={`${libreBaskerville.variable} ${montserrat.variable}`}>
>>>>>>> Stashed changes
      <body>
        <Providers>
          <Navbar />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
