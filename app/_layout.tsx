import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { SettingsProvider, useSharedSettings } from "../src/context/SettingsContext";
import { LocalizationProvider } from "../src/i18n";
import { ThemeProvider } from "../src/theme/ThemeContext";

function RootLayoutInner() {
  const { settings } = useSharedSettings();

  return (
    <LocalizationProvider language={settings.language}>
      <ThemeProvider mode={settings.theme}>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </LocalizationProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <RootLayoutInner />
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
