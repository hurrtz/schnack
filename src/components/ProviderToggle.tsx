import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  PROVIDER_LABELS,
  PROVIDER_ORDER,
  PROVIDER_SHORT_LABELS,
} from "../constants/models";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Provider } from "../types";
import { ProviderIcon } from "./ProviderIcon";

interface ProviderToggleProps {
  selected: Provider;
  onSelect: (provider: Provider) => void;
  visibleProviders?: Provider[];
}

export function ProviderToggle({
  selected,
  onSelect,
  visibleProviders = PROVIDER_ORDER,
}: ProviderToggleProps) {
  const { colors } = useTheme();
  const providers = visibleProviders;
  const isSingleProvider = providers.length === 1;
  const columnCount = isSingleProvider
    ? 2
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
              isSingleProvider ? styles.optionWrapSingle : null,
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
                  style={styles.optionInner}
                >
                  {content}
                </LinearGradient>
              ) : (
                <View style={styles.optionInner}>{content}</View>
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
    alignItems: "flex-start",
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
  optionWrapSingle: {
    alignSelf: "center",
  },
  option: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  optionInner: {
    minHeight: 72,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  optionActiveShell: {
    borderColor: "rgba(255,255,255,0.18)",
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
