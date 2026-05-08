"use client";

import { createContext, useContext, useMemo } from "react";
import { createFormatters, type Formatters } from "@/lib/formatters";

const FormatterContext = createContext<Formatters | null>(null);

export function FormatterProvider({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const fmt = useMemo(() => createFormatters(locale), [locale]);
  return <FormatterContext value={fmt}>{children}</FormatterContext>;
}

export function useFormatter(): Formatters {
  const ctx = useContext(FormatterContext);
  if (!ctx) throw new Error("useFormatter must be used within a FormatterProvider");
  return ctx;
}
