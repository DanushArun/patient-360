import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import "./saarthi.css";

export const metadata: Metadata = {
  title: "SAARTHI — Care Readiness & Evidence",
  description: "Care readiness & evidence copilot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "#FFFFFF" }}>{children}</body>
    </html>
  );
}
