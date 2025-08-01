import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VidNinja Player - TV Show",
  description: "Direct TV show streaming with VidNinja Player",
};

export default function TVLayout({ children }: { children: React.ReactNode }) {
  return children;
}
