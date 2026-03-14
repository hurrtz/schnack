import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { SettingsProvider, useSharedSettings } from "../src/context/SettingsContext";
import { ThemeProvider } from "../src/theme/ThemeContext";

function RootLayoutInner() {
  const { settings } = useSharedSettings();

  return (
    <ThemeProvider mode={settings.theme}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
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
