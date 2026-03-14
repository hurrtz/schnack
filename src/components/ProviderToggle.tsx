import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SvgUri } from "react-native-svg";
import {
  PROVIDER_LABELS,
  PROVIDER_ORDER,
  PROVIDER_SHORT_LABELS,
} from "../constants/models";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Provider } from "../types";

interface ProviderToggleProps {
  selected: Provider;
  onSelect: (provider: Provider) => void;
  visibleProviders?: Provider[];
}

const PROVIDER_ICON_ASSETS: Record<Provider, number> = {
  openai: require("../../assets/branding/openai.svg"),
  anthropic: require("../../assets/branding/anthropic.svg"),
  gemini: require("../../assets/branding/google.svg"),
  cohere: require("../../assets/branding/cohere.svg"),
  deepseek: require("../../assets/branding/deepseek.svg"),
  groq: require("../../assets/branding/groq.svg"),
  mistral: require("../../assets/branding/mistral.svg"),
  nvidia: require("../../assets/branding/nvidia.svg"),
  together: require("../../assets/branding/together.svg"),
  xai: require("../../assets/branding/xai.svg"),
};

const PROVIDER_ICON_SIZES: Record<Provider, { width: number; height: number }> = {
  openai: { width: 24, height: 24 },
  anthropic: { width: 24, height: 24 },
  gemini: { width: 24, height: 24 },
  cohere: { width: 24, height: 24 },
  deepseek: { width: 24, height: 24 },
  groq: { width: 24, height: 24 },
  mistral: { width: 24, height: 24 },
  nvidia: { width: 28, height: 28 },
  together: { width: 24, height: 24 },
  xai: { width: 24, height: 24 },
};

function ProviderIcon({
  provider,
  color,
}: {
  provider: Provider;
  color: string;
}) {
  const asset = PROVIDER_ICON_ASSETS[provider];
  const uri = Image.resolveAssetSource(asset).uri;
  const size = PROVIDER_ICON_SIZES[provider];

  return (
    <SvgUri
      width={size.width}
      height={size.height}
      uri={uri}
      color={color}
    />
  );
}

export function ProviderToggle({
  selected,
  onSelect,
  visibleProviders = PROVIDER_ORDER,
}: ProviderToggleProps) {
  const { colors } = useTheme();
  const providers = visibleProviders;
  const columnCount = providers.length <= 1
    ? 1
    : providers.length <= 3
      ? providers.length
      : 4;

  if (providers.length === 0) {
    return null;
  }

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
    >
      {providers.map((provider) => {
        const active = provider === selected;
        const content = (
          <>
            <View style={[styles.iconWrap, !active ? styles.iconWrapDim : null]}>
              <ProviderIcon
                provider={provider}
                color={
                  active
                    ? colors.text
                    : colors.textSecondary
                }
              />
            </View>
            <Text
              style={[
                styles.optionLabel,
                {
                  color: active
                    ? colors.text
                    : colors.textMuted,
                },
              ]}
              numberOfLines={1}
            >
              {PROVIDER_SHORT_LABELS[provider]}
            </Text>
          </>
        );

        return (
          <View
            key={provider}
            style={[
              styles.optionWrap,
              { width: `${100 / columnCount}%` },
            ]}
          >
            <Pressable
              style={[
                styles.option,
                active
                  ? styles.optionActiveShell
                  : {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
              ]}
              onPress={() => onSelect(provider)}
              accessibilityRole="button"
              accessibilityLabel={`Use ${PROVIDER_LABELS[provider]}`}
              accessibilityState={{ selected: active }}
            >
              {active ? (
                <LinearGradient
                  colors={[colors.accentGradientStart, colors.accentGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.option, styles.optionActive]}
                >
                  {content}
                </LinearGradient>
              ) : (
                content
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 26,
    padding: 6,
    position: "relative",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  optionWrap: {
    padding: 4,
  },
  option: {
    minHeight: 72,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    overflow: "hidden",
  },
  optionActiveShell: {
    borderColor: "rgba(255,255,255,0.18)",
  },
  optionActive: {
    borderWidth: 0,
    width: "100%",
    height: "100%",
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
    fontSize: 8,
    letterSpacing: 0.65,
    fontFamily: fonts.mono,
  },
});
