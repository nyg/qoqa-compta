import "./i18n/index"; // Side-effectful: initializes i18next before anything else
import "./globals.css";
import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider } from "./components/theme-provider";
import { FormatterProvider } from "./lib/formatter-context";
import { withSwissRegion } from "./lib/formatters";
import { DashboardPage } from "./pages/DashboardPage";
import i18n from "./i18n/index";

function App() {
  const [locale, setLocale] = useState(i18n.language || "fr");

  useEffect(() => {
    const handler = (lng: string) => setLocale(lng);
    i18n.on("languageChanged", handler);
    return () => i18n.off("languageChanged", handler);
  }, []);

  useEffect(() => {
    document.documentElement.lang = withSwissRegion(locale);
  }, [locale]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <I18nextProvider i18n={i18n}>
        <FormatterProvider locale={locale}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="*" element={<DashboardPage />} />
            </Routes>
          </BrowserRouter>
        </FormatterProvider>
      </I18nextProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
