import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Global Entertainment Report",
  description: "Automated sports journalism support for the modern newsroom.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-black">{children}</body>
    </html>
  );
}
