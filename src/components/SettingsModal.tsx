import React, { useEffect } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { OPENAI_MODELS, ANTHROPIC_MODELS, TTS_VOICES } from "../constants/models";
import { Settings, InputMode, TtsPlayback, ThemeMode } from "../types";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Picker } from "./Picker";

interface SettingsModalProps {
  visible: boolean;
  settings: Settings;
  onUpdate: (partial: Partial<Settings>) => void;
  onClose: () => void;
}

function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View style={styles.radioRow}>
        {options.map((opt) => {
          const active = value === opt.value;

          return (
            <TouchableOpacity
              key={opt.value}
              style={styles.radioButtonWrap}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.9}
            >
              {active ? (
                <LinearGradient
                  colors={[colors.accentGradientStart, colors.accentGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.radioButton,
                    styles.radioButtonActive,
                    { shadowColor: colors.glowStrong },
                  ]}
                >
                  <Text style={[styles.radioLabel, styles.radioLabelActive]}>
                    {opt.label}
                  </Text>
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.radioButton,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.radioLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function PickerSection({
  children,
}: {
  children: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
    >
      {children}
    </View>
  );
}

export function SettingsModal({
  visible,
  settings,
  onUpdate,
  onClose,
}: SettingsModalProps) {
  const { colors } = useTheme();

  const scale = useSharedValue(0.96);
  const translateY = useSharedValue(16);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withTiming(1, {
        duration: 240,
        easing: Easing.out(Easing.ease),
      });
      translateY.value = withTiming(0, {
        duration: 240,
        easing: Easing.out(Easing.ease),
      });
      opacity.value = withTiming(1, { duration: 220 });
    } else {
      scale.value = 0.96;
      translateY.value = 16;
      opacity.value = 0;
    }
  }, [visible, opacity, scale, translateY]);

  const modalAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="none">
      <TouchableOpacity
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.modal,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.glow,
            },
            modalAnimStyle,
          ]}
          onStartShouldSetResponder={() => true}
        >
          <LinearGradient
            colors={[
              colors.accentSoft,
              "rgba(255, 255, 255, 0)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGlow}
          />

          <View
            style={[
              styles.header,
              { borderBottomColor: colors.border },
            ]}
          >
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>
                Conversation System
              </Text>
              <Text style={[styles.title, { color: colors.text }]}>
                Settings
              </Text>
              <Text
                style={[styles.subtitle, { color: colors.textSecondary }]}
              >
                Shape how VoxAI listens, speaks, and renders the room around it.
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.closeButton,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
              onPress={onClose}
            >
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <RadioGroup<InputMode>
              label="Input Mode"
              options={[
                { value: "push-to-talk", label: "Push to Talk" },
                { value: "toggle-to-talk", label: "Toggle to Talk" },
              ]}
              value={settings.inputMode}
              onChange={(v) => onUpdate({ inputMode: v })}
            />

            <RadioGroup<TtsPlayback>
              label="TTS Playback"
              options={[
                { value: "stream", label: "Stream" },
                { value: "wait", label: "Wait" },
              ]}
              value={settings.ttsPlayback}
              onChange={(v) => onUpdate({ ttsPlayback: v })}
            />

            <PickerSection>
              <Picker
                label="OpenAI Model"
                value={settings.openaiModel}
                options={OPENAI_MODELS.map((m) => ({
                  value: m.id,
                  label: m.name,
                }))}
                onChange={(v) => onUpdate({ openaiModel: v })}
              />
            </PickerSection>

            <PickerSection>
              <Picker
                label="Anthropic Model"
                value={settings.anthropicModel}
                options={ANTHROPIC_MODELS.map((m) => ({
                  value: m.id,
                  label: m.name,
                }))}
                onChange={(v) => onUpdate({ anthropicModel: v })}
              />
            </PickerSection>

            <PickerSection>
              <Picker
                label="TTS Voice"
                value={settings.ttsVoice}
                options={TTS_VOICES.map((v) => ({
                  value: v,
                  label: v.charAt(0).toUpperCase() + v.slice(1),
                }))}
                onChange={(v) => onUpdate({ ttsVoice: v })}
              />
            </PickerSection>

            <RadioGroup<ThemeMode>
              label="Theme"
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
              value={settings.theme}
              onChange={(v) => onUpdate({ theme: v })}
            />
          </ScrollView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "86%",
    borderRadius: 30,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.16,
    shadowRadius: 42,
    elevation: 12,
  },
  heroGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: fonts.displayHeavy,
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
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  content: {
    padding: 18,
    gap: 14,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 12,
    fontFamily: fonts.mono,
  },
  radioRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  radioButtonWrap: {
    width: "50%",
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  radioButton: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  radioButtonActive: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 7,
  },
  radioLabel: {
    fontSize: 14,
    textAlign: "center",
    fontFamily: fonts.display,
  },
  radioLabelActive: {
    color: "#F4F8FF",
  },
});
