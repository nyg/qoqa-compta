import React, { createContext, useContext, useMemo } from "react";
import { createFormatters, type Formatters } from "./formatters";

const FormatterContext = createContext<Formatters | null>(null);

export function FormatterProvider({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const formatters = useMemo(() => createFormatters(locale), [locale]);
  return (
    <FormatterContext.Provider value={formatters}>
      {children}
    </FormatterContext.Provider>
  );
}

export function useFormatter(): Formatters {
  const ctx = useContext(FormatterContext);
  if (!ctx) throw new Error("useFormatter must be used within FormatterProvider");
  return ctx;
}
