import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { lightColors, darkColors, Colors } from "./colors";
import { ThemeMode } from "../types";

interface ThemeContextValue {
  colors: Colors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  isDark: true,
});

export function ThemeProvider({
  mode,
  children,
}: {
  mode: ThemeMode;
  children: React.ReactNode;
}) {
  const systemScheme = useColorScheme();
  const isDark = mode === "system" ? systemScheme !== "light" : mode === "dark";
  const colors = isDark ? darkColors : lightColors;

  const value = useMemo(() => ({ colors, isDark }), [colors, isDark]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
