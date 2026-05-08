import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { parseAcceptLanguage } from "@/lib/formatters";
import { FormatterProvider } from "@/lib/formatter-context";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "QoQa Compta — Dashboard",
  description: "QoQa.ch spending dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const formatLocale = parseAcceptLanguage(hdrs.get("accept-language"));
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <FormatterProvider locale={formatLocale}>
            <div className="min-h-screen bg-background">{children}</div>
          </FormatterProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
