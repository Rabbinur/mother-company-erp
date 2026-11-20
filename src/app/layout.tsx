import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mother Company ERP | Enterprise Business Management Platform",
  description:
    "Complete Mother Company ERP: Inventory Accounting, Purchasing, Sales, Double-Entry Finance & Field Sales Integration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
