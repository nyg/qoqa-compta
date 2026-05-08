import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { parseAcceptLanguage } from "@/lib/formatters";
import { FormatterProvider } from "@/lib/formatter-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Qoqa Compta — Dashboard",
  description: "Qoqa.ch spending dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const locale = parseAcceptLanguage(hdrs.get("accept-language"));

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <FormatterProvider locale={locale}>
          <div className="min-h-screen bg-background">{children}</div>
        </FormatterProvider>
      </body>
    </html>
  );
}
