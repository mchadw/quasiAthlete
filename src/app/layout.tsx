import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "quasiAthlete — Multisport F1 Load Ledger & F2 Weekly Templates",
  description:
    "Evidence-grounded F1 load ledger, regional symptom surveillance, and gated thin-F2 weekly training templates for track + swim/erg/squash athletes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
