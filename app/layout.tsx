import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Growth AI | Centro de operações",
  description: "Operação de growth com agentes, evidências e controle humano.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
