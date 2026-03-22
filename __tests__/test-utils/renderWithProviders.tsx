import React from "react";
import { render, type RenderOptions } from "@testing-library/react-native";

import { LocalizationProvider } from "../../src/i18n";
import { ThemeProvider } from "../../src/theme/ThemeContext";
import { AppLanguage } from "../../src/types";

interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  language?: AppLanguage;
  themeMode?: "light" | "dark" | "system";
}

export function renderWithProviders(
  ui: React.ReactElement,
  { language = "en", themeMode = "light", ...options }: RenderWithProvidersOptions = {},
) {
  return render(
    <ThemeProvider mode={themeMode}>
      <LocalizationProvider language={language}>{ui}</LocalizationProvider>
    </ThemeProvider>,
    options,
  );
}
