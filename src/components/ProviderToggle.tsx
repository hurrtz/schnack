import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Provider } from "../types";

interface ProviderToggleProps {
  selected: Provider;
  onSelect: (provider: Provider) => void;
}

const PROVIDERS: { value: Provider; label: string; hint: string }[] = [
  { value: "openai", label: "OpenAI", hint: "Fast, bright, conversational" },
  {
    value: "anthropic",
    label: "Anthropic",
    hint: "Measured, thoughtful, nuanced",
  },
];

export function ProviderToggle({ selected, onSelect }: ProviderToggleProps) {
  const { colors } = useTheme();
  const isSecond = selected === "anthropic";
  const halfWidth = useSharedValue(0);

  const highlightStyle = useAnimatedStyle(() => ({
    width: halfWidth.value,
    transform: [
      {
        translateX: withTiming(isSecond ? halfWidth.value : 0, {
          duration: 260,
          easing: Easing.out(Easing.ease),
        }),
      },
    ],
  }));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.glow,
        },
      ]}
      onLayout={(e) => {
        halfWidth.value = (e.nativeEvent.layout.width - 10) / 2;
      }}
    >
      <Animated.View
        style={[
          styles.highlight,
          highlightStyle,
          {
            shadowColor: colors.glowStrong,
          },
        ]}
      >
        <LinearGradient
          colors={[colors.accentGradientStart, colors.accentGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.highlightGradient}
        />
      </Animated.View>
      {PROVIDERS.map((p) => (
        <Pressable
          key={p.value}
          style={styles.option}
          onPress={() => onSelect(p.value)}
        >
          <Text
            style={[
              styles.label,
              {
                color: selected === p.value ? "#FFFFFF" : colors.text,
              },
            ]}
          >
            {p.label}
          </Text>
          <Text
            style={[
              styles.hint,
              {
                color:
                  selected === p.value
                    ? "rgba(255, 255, 255, 0.78)"
                    : colors.textMuted,
              },
            ]}
          >
            {p.hint}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginTop: 18,
    borderRadius: 28,
    padding: 5,
    position: "relative",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
    elevation: 8,
  },
  highlight: {
    position: "absolute",
    top: 5,
    left: 5,
    bottom: 5,
    borderRadius: 23,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  highlightGradient: { flex: 1, borderRadius: 23 },
  option: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 13,
    zIndex: 1,
    gap: 4,
  },
  label: {
    fontSize: 15,
    fontFamily: fonts.display,
  },
  hint: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    fontFamily: fonts.body,
  },
});
