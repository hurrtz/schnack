import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ResponseModeToggle } from "../../components/ResponseModeToggle";
import { ProviderIcon } from "../../components/ProviderIcon";
import { Colors } from "../../theme/colors";
import { ResponseMode, ResponseModeRoute } from "../../types";

import { TranslateFn } from "./shared";
import { styles } from "./styles";

interface MainScreenRouteCardProps {
  activeResponseMode: ResponseMode;
  availableResponseModes: ResponseMode[];
  colors: Colors;
  onOpenGroqSettings: () => void;
  onSelectResponseMode: (mode: ResponseMode) => void;
  responseModes: Record<ResponseMode, ResponseModeRoute>;
  t: TranslateFn;
}

export function MainScreenRouteCard({
  activeResponseMode,
  availableResponseModes,
  colors,
  onOpenGroqSettings,
  onSelectResponseMode,
  responseModes,
  t,
}: MainScreenRouteCardProps) {
  return (
    <View
      style={[
        styles.heroCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.glow,
        },
      ]}
    >
      <LinearGradient
        colors={[colors.accentSoft, "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCardGlow}
      />
      {availableResponseModes.length > 0 ? (
        <ResponseModeToggle
          selected={activeResponseMode}
          onSelect={onSelectResponseMode}
          routes={responseModes}
          readyModes={availableResponseModes}
        />
      ) : (
        <TouchableOpacity
          style={[
            styles.providerEmptyState,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
          onPress={onOpenGroqSettings}
          activeOpacity={0.9}
        >
          <View style={styles.providerEmptyHeader}>
            <View
              style={[
                styles.providerEmptyBadge,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.border,
                },
              ]}
            >
              <ProviderIcon provider="groq" color={colors.text} />
              <Text
                style={[styles.providerEmptyBadgeText, { color: colors.text }]}
              >
                Groq
              </Text>
            </View>
            <Feather name="arrow-up-right" size={16} color={colors.accent} />
          </View>
          <Text style={[styles.providerEmptyTitle, { color: colors.text }]}>
            {t("startWithGroq")}
          </Text>
          <Text
            style={[styles.providerEmptyText, { color: colors.textSecondary }]}
          >
            {t("groqStarterDescription")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
