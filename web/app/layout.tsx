import type { Metadata } from "next";
import "./tokens.css";
import "./fonts.css";
import "./globals.css";
import "./saarthi.css";
import "./workspace.css";
import "./workspace-refresh.css";
import "./workspace-panels.css";
import "./workspace-responsive.css";
import "./workspace-shell.css";

export const metadata: Metadata = {
  title: "SAARTHI — Care Readiness & Evidence",
  description: "Care readiness & evidence copilot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
