import React from "react";
import { View, Pressable, StyleSheet, Text } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  PROVIDER_LABELS,
  PROVIDER_ORDER,
} from "../constants/models";
import {
  AnthropicMark,
  GeminiMark,
  NvidiaMark,
  OpenAIMark,
} from "./ProviderMarks";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Provider } from "../types";

interface ProviderToggleProps {
  selected: Provider;
  onSelect: (provider: Provider) => void;
}

const TOGGLE_PADDING = 5;

interface ProviderIconProps {
  color: string;
  width: number;
  height: number;
}

const PROVIDER_ICONS: Record<
  Provider,
  React.ComponentType<ProviderIconProps>
> = {
  openai: OpenAIMark,
  anthropic: AnthropicMark,
  gemini: GeminiMark,
  nvidia: NvidiaMark,
};

const PROVIDER_ICON_SIZES: Record<
  Provider,
  { width: number; height: number }
> = {
  openai: { width: 25, height: 25 },
  anthropic: { width: 25, height: 25 },
  gemini: { width: 25, height: 25 },
  nvidia: { width: 29, height: 29 },
};

const PROVIDER_SHORT_LABELS: Record<Provider, string> = {
  openai: "OPENAI",
  anthropic: "CLAUDE",
  gemini: "GEMINI",
  nvidia: "NVIDIA",
};

export function ProviderToggle({ selected, onSelect }: ProviderToggleProps) {
  const { colors } = useTheme();
  const optionWidth = useSharedValue(0);
  const selectedIndex = PROVIDER_ORDER.indexOf(selected);

  const highlightStyle = useAnimatedStyle(() => ({
    width: optionWidth.value,
    transform: [
      {
        translateX: withTiming(selectedIndex * optionWidth.value, {
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
      onLayout={(event) => {
        optionWidth.value =
          (event.nativeEvent.layout.width - TOGGLE_PADDING * 2) /
          PROVIDER_ORDER.length;
      }}
    >
      <Animated.View
        style={[
          styles.highlight,
          highlightStyle,
          {
            shadowColor: colors.glow,
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.borderStrong,
          },
        ]}
      >
        <LinearGradient
          colors={[colors.accentSoft, "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.highlightGradient}
        />
      </Animated.View>
      {PROVIDER_ORDER.map((provider) => {
        const active = provider === selected;
        const Icon = PROVIDER_ICONS[provider];
        const iconSize = PROVIDER_ICON_SIZES[provider];

        return (
          <Pressable
            key={provider}
            style={styles.option}
            onPress={() => onSelect(provider)}
            accessibilityRole="button"
            accessibilityLabel={`Use ${PROVIDER_LABELS[provider]}`}
          >
            <View style={[styles.iconWrap, !active ? styles.iconWrapDim : null]}>
              <Icon
                width={iconSize.width}
                height={iconSize.height}
                color={active ? colors.text : colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.optionLabel,
                { color: active ? colors.text : colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {PROVIDER_SHORT_LABELS[provider]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 24,
    padding: TOGGLE_PADDING,
    position: "relative",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  highlight: {
    position: "absolute",
    top: 5,
    left: 5,
    bottom: 5,
    borderRadius: 19,
    overflow: "hidden",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  highlightGradient: {
    flex: 1,
    borderRadius: 19,
  },
  option: {
    flex: 1,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    zIndex: 1,
  },
  iconWrap: {
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapDim: {
    opacity: 0.76,
  },
  optionLabel: {
    fontSize: 9,
    letterSpacing: 0.7,
    fontFamily: fonts.mono,
  },
});
