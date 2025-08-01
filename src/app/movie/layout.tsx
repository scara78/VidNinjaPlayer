import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VidNinja Player - Movie",
  description: "Direct movie streaming with VidNinja Player",
};

export default function MovieLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
