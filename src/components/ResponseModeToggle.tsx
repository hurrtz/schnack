import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getProviderModelName } from "../constants/models";
import { useLocalization } from "../i18n";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { ResponseMode, ResponseModeSelections } from "../types";
import { RESPONSE_MODE_ORDER } from "../utils/responseModes";
import { ProviderIcon } from "./ProviderIcon";

interface ResponseModeToggleProps {
  selected: ResponseMode;
  onSelect: (mode: ResponseMode) => void;
  routes: ResponseModeSelections;
  readyModes?: ResponseMode[];
}

function getResponseModeLabel(
  mode: ResponseMode,
  t: ReturnType<typeof useLocalization>["t"],
) {
  switch (mode) {
    case "quick":
      return t("quickAndShallow");
    case "normal":
      return t("normal");
    case "deep":
      return t("deepThinking");
  }
}

export function ResponseModeToggle({
  selected,
  onSelect,
  routes,
  readyModes = RESPONSE_MODE_ORDER,
}: ResponseModeToggleProps) {
  const { colors } = useTheme();
  const { t } = useLocalization();

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
      {RESPONSE_MODE_ORDER.map((mode) => {
        const active = mode === selected;
        const route = routes[mode];
        const ready = readyModes.includes(mode);
        const content = (
          <>
            <View style={styles.optionHeader}>
              <Text
                style={[
                  styles.optionLabel,
                  { color: active ? colors.text : colors.textSecondary },
                ]}
              >
                {getResponseModeLabel(mode, t)}
              </Text>
            </View>

            <View style={styles.providerRow}>
              <ProviderIcon
                provider={route.provider}
                color={active ? colors.text : colors.textSecondary}
              />
            </View>

            <Text
              style={[
                styles.modelText,
                { color: active ? colors.text : colors.textMuted },
              ]}
              numberOfLines={2}
            >
              {getProviderModelName(route.provider, route.model)}
            </Text>
          </>
        );

        return (
          <Pressable
            key={mode}
            style={[
              styles.option,
              !ready ? styles.optionDisabled : null,
              active
                ? styles.optionActiveShell
                : {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
            ]}
            onPress={() => onSelect(mode)}
            accessibilityRole="button"
            accessibilityLabel={t("useResponseMode", {
              mode: getResponseModeLabel(mode, t),
            })}
            accessibilityState={{ disabled: !ready, selected: active }}
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
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 26,
    padding: 6,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  option: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  optionActiveShell: {
    borderColor: "rgba(255,255,255,0.18)",
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionInner: {
    minHeight: 96,
    borderRadius: 17,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
  },
  optionHeader: {
    minHeight: 17,
    alignItems: "center",
  },
  optionLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.display,
  },
  providerRow: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 24,
  },
  modelText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    textAlign: "center",
  },
});
