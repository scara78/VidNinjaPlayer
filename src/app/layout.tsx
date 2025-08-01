import type { Metadata } from "next";
import {
  Outfit,
  Gabarito,
  Atkinson_Hyperlegible,
  Rethink_Sans,
} from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const atkinsonHyperlegible = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const rethinkSans = Rethink_Sans({
  variable: "--font-rethink",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "VidNinja - Streaming Player",
  description:
    "Advanced streaming player with TV show navigation and real-time episode switching",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${gabarito.variable} ${atkinsonHyperlegible.variable} ${rethinkSans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
