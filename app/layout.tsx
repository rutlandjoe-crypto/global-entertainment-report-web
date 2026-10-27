import GsrNewsletterSignup from "./GsrNewsletterSignup";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Global Entertainment Report",
  description: "Entertainment news and reporting support for the modern newsroom.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4702397566533444"
          crossOrigin="anonymous"
        ></script>
      </head>
      <body className="bg-white text-black">{children}
        <GsrNewsletterSignup /></body>
    </html>
  );
}
