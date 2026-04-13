import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ASB — Painel SDR",
  description: "American Steak Brasil — Painel de Vendas",
  other: {
    google: "notranslate",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col" style={{ background: "#0d1117", color: "#e6edf3" }}>
        {children}
      </body>
    </html>
  );
}
