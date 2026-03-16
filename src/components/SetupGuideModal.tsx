import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalization } from "../i18n";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";

type SetupPreset = "fastest" | "full-voice";

interface SetupGuideModalProps {
  visible: boolean;
  onChoosePreset: (preset: SetupPreset) => void;
  onDismiss: () => void;
}

export function SetupGuideModal({
  visible,
  onChoosePreset,
  onDismiss,
}: SetupGuideModalProps) {
  const { colors } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={[
          styles.overlay,
          {
            paddingTop: Math.max(insets.top + 24, 36),
            paddingBottom: Math.max(insets.bottom + 24, 36),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={onDismiss}
        />
        <View
          style={[
            styles.card,
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
            style={styles.glow}
          />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>
                {t("firstRun")}
              </Text>
              <Text style={[styles.title, { color: colors.text }]}>
                {t("setupGuideTitle")}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t("setupGuideSubtitle")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onDismiss}
              style={[
                styles.closeButton,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
              activeOpacity={0.85}
            >
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.optionList}>
            <View
              style={[
                styles.optionCard,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                {t("fastestStartPreset")}
              </Text>
              <Text
                style={[styles.optionDescription, { color: colors.textSecondary }]}
              >
                {t("fastestStartDescription")}
              </Text>
              <Text style={[styles.note, { color: colors.textMuted }]}>
                {t("setupGuideNote")}
              </Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onChoosePreset("fastest")}
              >
                <LinearGradient
                  colors={[colors.accentGradientStart, colors.accentGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>{t("useThisSetup")}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.optionCard,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                {t("fullVoicePreset")}
              </Text>
              <Text
                style={[styles.optionDescription, { color: colors.textSecondary }]}
              >
                {t("fullVoiceDescription")}
              </Text>
              <Text style={[styles.note, { color: colors.textMuted }]}>
                {t("setupGuideNote")}
              </Text>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                activeOpacity={0.88}
                onPress={() => onChoosePreset("full-voice")}
              >
                <Text
                  style={[styles.secondaryButtonText, { color: colors.text }]}
                >
                  {t("useThisSetup")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={onDismiss}
            style={[
              styles.dismissButton,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
            activeOpacity={0.85}
          >
            <Text style={[styles.dismissButtonText, { color: colors.textSecondary }]}>
              {t("notNow")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 30,
    borderWidth: 1,
    padding: 22,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.16,
    shadowRadius: 40,
    elevation: 10,
  },
  glow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  header: {
    flexDirection: "row",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: fonts.display,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  optionList: {
    marginTop: 20,
    gap: 14,
  },
  optionCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  optionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: fonts.display,
  },
  optionDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  note: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  primaryButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#F4F8FF",
    fontSize: 14,
    fontFamily: fonts.display,
  },
  secondaryButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: fonts.display,
  },
  dismissButton: {
    marginTop: 18,
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissButtonText: {
    fontSize: 13,
    fontFamily: fonts.display,
  },
});
