import React, { createContext, useContext } from "react";
import { useSettings } from "../hooks/useSettings";

type SettingsContextValue = ReturnType<typeof useSettings>;

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useSettings();

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSharedSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSharedSettings must be used within a SettingsProvider");
  }

  return context;
}
