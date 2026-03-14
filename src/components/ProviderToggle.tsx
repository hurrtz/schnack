import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { Provider } from "../types";

interface ProviderToggleProps {
  selected: Provider;
  onSelect: (provider: Provider) => void;
}

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

export function ProviderToggle({ selected, onSelect }: ProviderToggleProps) {
  const { colors } = useTheme();
  const isSecond = selected === "anthropic";
  const halfWidth = useSharedValue(0);

  const highlightStyle = useAnimatedStyle(() => ({
    width: halfWidth.value,
    transform: [{ translateX: withTiming(isSecond ? halfWidth.value : 0, { duration: 250, easing: Easing.out(Easing.ease) }) }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]} onLayout={(e) => { halfWidth.value = (e.nativeEvent.layout.width - 8) / 2; }}>
      <Animated.View style={[styles.highlight, highlightStyle, { shadowColor: colors.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10, elevation: 8 }]}>
        <LinearGradient colors={[colors.accentGradientStart, colors.accentGradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.highlightGradient} />
      </Animated.View>
      {PROVIDERS.map((p) => (
        <Pressable key={p.value} style={styles.option} onPress={() => onSelect(p.value)}>
          <Text style={[styles.label, { color: selected === p.value ? "#FFFFFF" : colors.textSecondary, fontWeight: selected === p.value ? "600" : "500" }]}>{p.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", marginHorizontal: 16, borderRadius: 25, padding: 4, position: "relative" },
  highlight: { position: "absolute", top: 4, left: 4, bottom: 4 },
  highlightGradient: { flex: 1, borderRadius: 21 },
  option: { flex: 1, alignItems: "center", paddingVertical: 10, zIndex: 1 },
  label: { fontSize: 13 },
});
