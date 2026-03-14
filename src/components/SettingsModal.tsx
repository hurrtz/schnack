import React, { useEffect } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import {
  PROVIDER_API_KEY_HINTS,
  PROVIDER_API_KEY_PLACEHOLDERS,
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  PROVIDER_ORDER,
  TTS_VOICES,
} from "../constants/models";
import { Settings, InputMode, Provider, TtsPlayback, ThemeMode } from "../types";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { ProviderIcon } from "./ProviderIcon";
import { Picker } from "./Picker";

interface SettingsModalProps {
  visible: boolean;
  settings: Settings;
  onUpdate: (partial: Partial<Omit<Settings, "apiKeys" | "providerModels">>) => void;
  onUpdateProviderModel: (provider: Provider, model: string) => void;
  onUpdateApiKey: (provider: Provider, apiKey: string) => void;
  onPreviewVoice: (text: string, voice: string) => Promise<void>;
  onClose: () => void;
}

function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; description?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  const activeOption = options.find((opt) => opt.value === value);

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
      {activeOption?.description ? (
        <Text
          style={[
            styles.sectionHint,
            { color: colors.textMuted },
          ]}
        >
          {activeOption.description}
        </Text>
      ) : null}
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

function ProviderSection({
  settings,
  onUpdateProviderModel,
  onUpdateApiKey,
}: {
  settings: Settings;
  onUpdateProviderModel: (provider: Provider, model: string) => void;
  onUpdateApiKey: (provider: Provider, apiKey: string) => void;
}) {
  const { colors } = useTheme();
  const [selectedProvider, setSelectedProvider] = React.useState<Provider>(
    settings.lastProvider
  );

  useEffect(() => {
    setSelectedProvider(settings.lastProvider);
  }, [settings.lastProvider]);

  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        Providers
      </Text>
      <Text style={[styles.sectionIntro, { color: colors.textMuted }]}>
        Keys are stored securely on this device. Providers stay disabled until
        their key is entered here.
      </Text>

      <View style={styles.providerButtonGrid}>
        {PROVIDER_ORDER.map((provider) => {
          const active = provider === selectedProvider;

          return (
            <Pressable
              key={provider}
              style={[
                styles.providerButton,
                {
                  backgroundColor: active
                    ? colors.surface
                    : colors.surfaceElevated,
                  borderColor: active ? colors.borderStrong : colors.border,
                  shadowColor: active ? colors.glow : "transparent",
                },
              ]}
              onPress={() => setSelectedProvider(provider)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${PROVIDER_LABELS[provider]} settings`}
              accessibilityState={{ selected: active }}
            >
              <ProviderIcon
                provider={provider}
                color={active ? colors.text : colors.textSecondary}
              />
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.apiKeyCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.apiKeyTitle, { color: colors.text }]}>
          {PROVIDER_LABELS[selectedProvider]}
        </Text>
        <Text
          style={[
            styles.apiKeyHint,
            { color: colors.textMuted },
          ]}
        >
          {PROVIDER_API_KEY_HINTS[selectedProvider]}
        </Text>
        <TextInput
          value={settings.apiKeys[selectedProvider]}
          onChangeText={(value) => onUpdateApiKey(selectedProvider, value)}
          placeholder={PROVIDER_API_KEY_PLACEHOLDERS[selectedProvider]}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          style={[
            styles.apiKeyInput,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
        />
        <Picker
          label={`${PROVIDER_LABELS[selectedProvider]} Model`}
          value={settings.providerModels[selectedProvider]}
          options={PROVIDER_MODELS[selectedProvider].map((model) => ({
            value: model.id,
            label: model.name,
          }))}
          onChange={(value) => onUpdateProviderModel(selectedProvider, value)}
        />
      </View>
    </View>
  );
}

export function SettingsModal({
  visible,
  settings,
  onUpdate,
  onUpdateProviderModel,
  onUpdateApiKey,
  onPreviewVoice,
  onClose,
}: SettingsModalProps) {
  const { colors } = useTheme();
  const [previewText, setPreviewText] = React.useState(
    "Hallo, ich bin VoxAI."
  );
  const [previewLoading, setPreviewLoading] = React.useState(false);

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

  const handlePreviewVoice = async () => {
    const trimmed = previewText.trim();
    if (!trimmed || previewLoading) {
      return;
    }

    setPreviewLoading(true);
    try {
      await onPreviewVoice(trimmed, settings.ttsVoice);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.overlay}>
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={onClose}
        />
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
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            nestedScrollEnabled
          >
            <RadioGroup<InputMode>
              label="Input Mode"
              options={[
                {
                  value: "push-to-talk",
                  label: "Push to Talk",
                  description: "Hold the main button while speaking, then release to send.",
                },
                {
                  value: "toggle-to-talk",
                  label: "Toggle to Talk",
                  description: "Tap once to start recording and tap again when you are done.",
                },
              ]}
              value={settings.inputMode}
              onChange={(v) => onUpdate({ inputMode: v })}
            />

            <RadioGroup<TtsPlayback>
              label="TTS Playback"
              options={[
                {
                  value: "stream",
                  label: "Stream",
                  description: "Replies start speaking as soon as complete sentences are ready.",
                },
                {
                  value: "wait",
                  label: "Wait",
                  description: "The full reply is generated first, then played back in one pass.",
                },
              ]}
              value={settings.ttsPlayback}
              onChange={(v) => onUpdate({ ttsPlayback: v })}
            />

            <ProviderSection
              settings={settings}
              onUpdateProviderModel={onUpdateProviderModel}
              onUpdateApiKey={onUpdateApiKey}
            />

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
              <View
                style={[
                  styles.previewCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.previewLabel, { color: colors.textSecondary }]}
                >
                  Voice Preview Text
                </Text>
                <TextInput
                  value={previewText}
                  onChangeText={setPreviewText}
                  multiline
                  placeholder="Type a phrase to hear this voice."
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.accent}
                  style={[
                    styles.previewInput,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />
                <Text
                  style={[styles.previewHint, { color: colors.textMuted }]}
                >
                  Uses the selected voice without sending anything to the model.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={handlePreviewVoice}
                  disabled={previewLoading || !previewText.trim()}
                >
                  <LinearGradient
                    colors={[colors.accentGradientStart, colors.accentGradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.previewButton,
                      !previewText.trim() || previewLoading
                        ? styles.previewButtonDisabled
                        : null,
                    ]}
                  >
                    <Feather
                      name={previewLoading ? "loader" : "volume-2"}
                      size={16}
                      color="#F4F8FF"
                    />
                    <Text style={styles.previewButtonText}>
                      {previewLoading ? "Generating Preview..." : "Preview Voice"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
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
      </View>
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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
  sectionIntro: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: -2,
    marginBottom: 14,
    fontFamily: fonts.body,
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    fontFamily: fonts.body,
  },
  providerButtonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  providerButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  apiKeyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  apiKeyTitle: {
    fontSize: 14,
    fontFamily: fonts.display,
  },
  apiKeyHint: {
    marginTop: 6,
    marginBottom: 10,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  apiKeyInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: fonts.body,
  },
  previewCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
  },
  previewLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 10,
    fontFamily: fonts.mono,
  },
  previewInput: {
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
    fontFamily: fonts.body,
  },
  previewHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  previewButton: {
    marginTop: 14,
    borderRadius: 18,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 7,
  },
  previewButtonDisabled: {
    opacity: 0.55,
  },
  previewButtonText: {
    color: "#F4F8FF",
    fontSize: 14,
    fontFamily: fonts.display,
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
