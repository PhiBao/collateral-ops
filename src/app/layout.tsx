import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CollateralOps Terminal",
  description: "Private Canton collateral mobility terminal for institutional margin workflows.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
