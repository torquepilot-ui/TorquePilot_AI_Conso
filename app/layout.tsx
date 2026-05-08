import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TorquePilot AI Conso",
  description: "Dashboard local TorquePilot pour projets, clients et consommation IA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
