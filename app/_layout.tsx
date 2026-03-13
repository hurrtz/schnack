import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { ThemeProvider } from "../src/theme/ThemeContext";
import { useSettings } from "../src/hooks/useSettings";

function RootLayoutInner() {
  const { settings } = useSettings();

  return (
    <ThemeProvider mode={settings.theme}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootLayoutInner />
    </GestureHandlerRootView>
  );
}
