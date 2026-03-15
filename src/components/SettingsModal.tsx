import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PROVIDER_API_KEY_HINTS,
  PROVIDER_API_KEY_PLACEHOLDERS,
  PROVIDER_API_KEY_URLS,
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  PROVIDER_ORDER,
  TTS_VOICES,
} from "../constants/models";
import {
  AssistantResponseLength,
  AssistantResponseTone,
  InputMode,
  Provider,
  ReplyPlayback,
  Settings,
  ThemeMode,
  VoiceBackendMode,
} from "../types";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { getEnabledSttProviders, getEnabledTtsProviders } from "../utils/providerCapabilities";
import { Picker } from "./Picker";
import { ProviderIcon } from "./ProviderIcon";

interface SettingsModalProps {
  visible: boolean;
  settings: Settings;
  focusProvider?: Provider;
  onUpdate: (partial: Partial<Omit<Settings, "apiKeys" | "providerModels">>) => void;
  onUpdateProviderModel: (provider: Provider, model: string) => void;
  onUpdateApiKey: (provider: Provider, apiKey: string) => void;
  onPreviewVoice: (text: string) => Promise<void>;
  onClose: () => void;
}

type SettingsTab = "instructions" | "providers" | "stt" | "tts" | "ui";

const TABS: SettingsTab[] = [
  "instructions",
  "providers",
  "stt",
  "tts",
  "ui",
];

const TAB_LABELS: Record<SettingsTab, string> = {
  instructions: "Instructions",
  providers: "Providers",
  stt: "STT",
  tts: "TTS",
  ui: "UI",
};

const TAB_DESCRIPTIONS: Partial<Record<SettingsTab, string>> = {
  instructions:
    "Shape the hidden guidance that steers the assistant before any provider sees the request.",
  providers:
    "Connect providers, store keys on-device, and decide which model each provider should use.",
  stt:
    "Control how speech is captured and which backend turns audio into text before it reaches the model.",
  tts:
    "Control when replies start speaking and which backend handles spoken output.",
};

const RESPONSE_LENGTH_OPTIONS: {
  value: AssistantResponseLength;
  label: string;
  description: string;
}[] = [
  {
    value: "brief",
    label: "Brief",
    description:
      "Keep the answer tight. Use the minimum number of sentences needed to fully answer the user.",
  },
  {
    value: "normal",
    label: "Normal",
    description:
      "Aim for a balanced response length. Cover the important points without dragging the answer out.",
  },
  {
    value: "thorough",
    label: "Thorough",
    description:
      "Go deep and be comprehensive. Include nuance, detail, tradeoffs, and the reasoning that matters.",
  },
];

const RESPONSE_TONE_OPTIONS: {
  value: AssistantResponseTone;
  label: string;
  description: string;
}[] = [
  {
    value: "professional",
    label: "Professional",
    description:
      "Speak like a senior consultant briefing a client. Precise language, no slang, measured and authoritative.",
  },
  {
    value: "casual",
    label: "Casual",
    description:
      "Speak like a smart friend at a coffee shop. Relaxed, natural, conversational. Contractions are fine, tangents are fine.",
  },
  {
    value: "nerdy",
    label: "Nerdy",
    description:
      "Speak like an enthusiastic expert who loves going deep. Use technical terminology freely, geek out about details, assume the user can keep up.",
  },
  {
    value: "concise",
    label: "Concise",
    description:
      "Be as brief as possible while still being complete. No preamble, no filler, just the answer. Think telegram style.",
  },
  {
    value: "socratic",
    label: "Socratic",
    description:
      "Challenge the user's thinking. Ask counter-questions, offer alternative perspectives, don't just confirm what they said. Be a sparring partner, not a yes-machine.",
  },
  {
    value: "eli5",
    label: "ELI5",
    description:
      "Explain everything as simply as possible. Use analogies, everyday language, zero jargon. Assume no prior knowledge on any topic.",
  },
];

function TabIntro({ tab }: { tab: SettingsTab }) {
  const { colors } = useTheme();
  const description = TAB_DESCRIPTIONS[tab];

  if (!description) {
    return null;
  }

  return (
    <Text style={[styles.tabIntroText, { color: colors.textSecondary }]}>
      {description}
    </Text>
  );
}

function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; description?: string; disabled?: boolean }[];
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
          const disabled = !!opt.disabled;

          return (
            <TouchableOpacity
              key={opt.value}
              style={styles.radioButtonWrap}
              onPress={() => {
                if (!disabled) {
                  onChange(opt.value);
                }
              }}
              activeOpacity={disabled ? 1 : 0.9}
              disabled={disabled}
            >
              {active ? (
                <LinearGradient
                  colors={[colors.accentGradientStart, colors.accentGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.radioButton,
                    styles.radioButtonActive,
                    {
                      shadowColor: colors.glowStrong,
                      opacity: disabled ? 0.45 : 1,
                    },
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
                      opacity: disabled ? 0.45 : 1,
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
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          {activeOption.description}
        </Text>
      ) : null}
    </View>
  );
}

function PickerSection({ children }: { children: React.ReactNode }) {
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
  focusProvider,
  onUpdateProviderModel,
  onUpdateApiKey,
}: {
  settings: Settings;
  focusProvider?: Provider;
  onUpdateProviderModel: (provider: Provider, model: string) => void;
  onUpdateApiKey: (provider: Provider, apiKey: string) => void;
}) {
  const { colors } = useTheme();
  const [selectedProvider, setSelectedProvider] = useState<Provider>(
    focusProvider ?? settings.lastProvider
  );

  useEffect(() => {
    setSelectedProvider(focusProvider ?? settings.lastProvider);
  }, [focusProvider, settings.lastProvider]);

  const handleOpenProviderPortal = React.useCallback(() => {
    void Linking.openURL(PROVIDER_API_KEY_URLS[selectedProvider]);
  }, [selectedProvider]);

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
        <Text style={[styles.apiKeyHint, { color: colors.textMuted }]}>
          {PROVIDER_API_KEY_HINTS[selectedProvider]}
        </Text>
        <TouchableOpacity
          style={[
            styles.apiKeyLinkButton,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
          onPress={handleOpenProviderPortal}
          accessibilityRole="link"
          accessibilityLabel={`Create ${PROVIDER_LABELS[selectedProvider]} API key`}
          activeOpacity={0.85}
        >
          <Text style={[styles.apiKeyLinkText, { color: colors.text }]}>
            Create API key
          </Text>
          <Feather name="external-link" size={14} color={colors.accent} />
        </TouchableOpacity>
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

function AssistantResponseSection({
  settings,
  onUpdate,
}: {
  settings: Settings;
  onUpdate: (partial: Partial<Omit<Settings, "apiKeys" | "providerModels">>) => void;
}) {
  const { colors } = useTheme();
  const selectedLength = RESPONSE_LENGTH_OPTIONS.find(
    (option) => option.value === settings.responseLength
  );
  const selectedTone = RESPONSE_TONE_OPTIONS.find(
    (option) => option.value === settings.responseTone
  );

  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        Assistant Instructions
      </Text>
      <Text style={[styles.sectionIntro, { color: colors.textMuted }]}>
        Shape the hidden guidance the model receives before every reply.
      </Text>

      <View
        style={[
          styles.promptCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.promptLabel, { color: colors.textSecondary }]}>
          Base Instructions
        </Text>
        <TextInput
          value={settings.assistantInstructions}
          onChangeText={(value) => onUpdate({ assistantInstructions: value })}
          multiline
          placeholder="Define how the assistant should behave."
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          style={[
            styles.promptInput,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
        />
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          This is always prepended before the selected response length and tone.
        </Text>
      </View>

      <Picker
        label="Adaptive Length"
        value={settings.responseLength}
        options={RESPONSE_LENGTH_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        onChange={(value) =>
          onUpdate({ responseLength: value as AssistantResponseLength })
        }
      />
      {selectedLength ? (
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          {selectedLength.description}
        </Text>
      ) : null}

      <Picker
        label="Response Tone"
        value={settings.responseTone}
        options={RESPONSE_TONE_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        onChange={(value) =>
          onUpdate({ responseTone: value as AssistantResponseTone })
        }
      />
      {selectedTone ? (
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          {selectedTone.description}
        </Text>
      ) : null}
    </View>
  );
}

function TtsPreviewSection({
  previewText,
  setPreviewText,
  previewLoading,
  onPreview,
  supportsVoicePicker,
  settings,
  onUpdate,
}: {
  previewText: string;
  setPreviewText: (text: string) => void;
  previewLoading: boolean;
  onPreview: () => Promise<void>;
  supportsVoicePicker: boolean;
  settings: Settings;
  onUpdate: (partial: Partial<Omit<Settings, "apiKeys" | "providerModels">>) => void;
}) {
  const { colors } = useTheme();

  return (
    <PickerSection>
      {supportsVoicePicker ? (
        <Picker
          label="TTS Voice"
          value={settings.ttsVoice}
          options={TTS_VOICES.map((voice) => ({
            value: voice,
            label: voice.charAt(0).toUpperCase() + voice.slice(1),
          }))}
          onChange={(value) => onUpdate({ ttsVoice: value })}
        />
      ) : (
        <View
          style={[
            styles.previewCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginTop: 0,
              marginBottom: 8,
            },
          ]}
        >
          <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
            Voice Selection
          </Text>
          <Text style={[styles.previewHint, { color: colors.textMuted, marginTop: 0 }]}>
            Native playback uses the device voice chosen by the operating system.
          </Text>
        </View>
      )}

      <View
        style={[
          styles.previewCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
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
        <Text style={[styles.previewHint, { color: colors.textMuted }]}>
          Uses the currently selected reply voice backend without sending
          anything to the language model.
        </Text>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            void onPreview();
          }}
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
  );
}

function renderProviderPickerOptions(providers: Provider[]) {
  return providers.map((provider) => ({
    value: provider,
    label: PROVIDER_LABELS[provider],
  }));
}

export function SettingsModal({
  visible,
  settings,
  focusProvider,
  onUpdate,
  onUpdateProviderModel,
  onUpdateApiKey,
  onPreviewVoice,
  onClose,
}: SettingsModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const contentScrollRef = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("instructions");
  const [previewText, setPreviewText] = useState("Hallo, ich bin VoxAI.");
  const [previewLoading, setPreviewLoading] = useState(false);

  const enabledSttProviders = useMemo(
    () => getEnabledSttProviders(settings),
    [settings]
  );
  const enabledTtsProviders = useMemo(
    () => getEnabledTtsProviders(settings),
    [settings]
  );

  const scale = useSharedValue(0.96);
  const translateY = useSharedValue(16);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scale.value = 0.96;
      translateY.value = 16;
      opacity.value = 0;
      return;
    }

    if (focusProvider) {
      setActiveTab("providers");
    }

    scale.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.ease),
    });
    translateY.value = withTiming(0, {
      duration: 240,
      easing: Easing.out(Easing.ease),
    });
    opacity.value = withTiming(1, { duration: 220 });
  }, [focusProvider, opacity, scale, translateY, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, [activeTab, visible]);

  useEffect(() => {
    if (!visible || settings.sttMode !== "provider") {
      return;
    }

    const nextProvider =
      settings.sttProvider && enabledSttProviders.includes(settings.sttProvider)
        ? settings.sttProvider
        : enabledSttProviders[0] ?? null;

    if (nextProvider !== settings.sttProvider) {
      onUpdate({ sttProvider: nextProvider });
    }
  }, [enabledSttProviders, onUpdate, settings.sttMode, settings.sttProvider, visible]);

  useEffect(() => {
    if (!visible || settings.ttsMode !== "provider") {
      return;
    }

    const nextProvider =
      settings.ttsProvider && enabledTtsProviders.includes(settings.ttsProvider)
        ? settings.ttsProvider
        : enabledTtsProviders[0] ?? null;

    if (nextProvider !== settings.ttsProvider) {
      onUpdate({ ttsProvider: nextProvider });
    }
  }, [enabledTtsProviders, onUpdate, settings.ttsMode, settings.ttsProvider, visible]);

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
      await onPreviewVoice(trimmed);
    } finally {
      setPreviewLoading(false);
    }
  };

  const providerPickerDisabled =
    settings.sttMode !== "provider" || enabledSttProviders.length === 0;
  const ttsProviderPickerDisabled =
    settings.ttsMode !== "provider" || enabledTtsProviders.length === 0;
  const supportsOpenAiVoicePicker =
    settings.ttsMode === "provider" && settings.ttsProvider === "openai";

  return (
    <Modal visible={visible} transparent animationType="none">
      <View
        style={[
          styles.overlay,
          {
            paddingTop: Math.max(insets.top + 10, 24),
          },
        ]}
      >
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
        >
          <LinearGradient
            colors={[colors.accentSoft, "rgba(255, 255, 255, 0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGlow}
          />

          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
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
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
          >
            {TABS.map((tab) => {
              const active = tab === activeTab;

              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabButton,
                    {
                      backgroundColor: active
                        ? colors.surfaceElevated
                        : colors.surface,
                      borderColor: active ? colors.borderStrong : colors.border,
                    },
                  ]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.tabButtonText,
                      { color: active ? colors.text : colors.textSecondary },
                    ]}
                  >
                    {TAB_LABELS[tab]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView
            ref={contentScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            nestedScrollEnabled
          >
            <TabIntro tab={activeTab} />

            {activeTab === "instructions" ? (
              <AssistantResponseSection settings={settings} onUpdate={onUpdate} />
            ) : null}

            {activeTab === "providers" ? (
              <ProviderSection
                settings={settings}
                focusProvider={focusProvider}
                onUpdateProviderModel={onUpdateProviderModel}
                onUpdateApiKey={onUpdateApiKey}
              />
            ) : null}

            {activeTab === "stt" ? (
              <>
                <RadioGroup<InputMode>
                  label="Input Mode"
                  options={[
                    {
                      value: "push-to-talk",
                      label: "Push to Talk",
                      description:
                        "Hold the main button while speaking, then release to send.",
                    },
                    {
                      value: "toggle-to-talk",
                      label: "Toggle to Talk",
                      description:
                        "Tap once to start recording and tap again when you are done.",
                    },
                  ]}
                  value={settings.inputMode}
                  onChange={(value) => onUpdate({ inputMode: value })}
                />

                <RadioGroup<VoiceBackendMode>
                  label="Speech to Text"
                  options={[
                    {
                      value: "native",
                      label: "App Native",
                      description:
                        "Use the system speech recognizer. VoxAI prefers on-device transcription when the device supports it.",
                    },
                    {
                      value: "provider",
                      label: "Provider",
                      description:
                        "Use a configured provider to transcribe your voice before it is sent to the model.",
                    },
                  ]}
                  value={settings.sttMode}
                  onChange={(value) => onUpdate({ sttMode: value })}
                />

                <PickerSection>
                  <Picker
                    label="STT Provider"
                    value={settings.sttProvider ?? ""}
                    options={renderProviderPickerOptions(enabledSttProviders)}
                    onChange={(value) =>
                      onUpdate({ sttProvider: value as Provider })
                    }
                    disabled={providerPickerDisabled}
                  />
                  <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
                    {settings.sttMode === "provider"
                      ? enabledSttProviders.length > 0
                        ? "Only enabled providers with transcription support appear here."
                        : "Enable a provider with STT support in the Providers tab to choose it here."
                      : "Native STT uses the device speech recognizer and does not require any provider key."}
                  </Text>
                </PickerSection>
              </>
            ) : null}

            {activeTab === "tts" ? (
              <>
                <RadioGroup<ReplyPlayback>
                  label="Reply Playback"
                  options={[
                    {
                      value: "stream",
                      label: "Sentences Arrive",
                      description:
                        "Start speaking as soon as complete sentences are ready.",
                    },
                    {
                      value: "wait",
                      label: "Full Reply First",
                      description:
                        "Generate the entire answer first, then play it in one pass.",
                    },
                  ]}
                  value={settings.replyPlayback}
                  onChange={(value) => onUpdate({ replyPlayback: value })}
                />

                <RadioGroup<VoiceBackendMode>
                  label="Text to Speech"
                  options={[
                    {
                      value: "native",
                      label: "App Native",
                      description:
                        "Use the device speech engine for spoken replies and voice preview.",
                    },
                    {
                      value: "provider",
                      label: "Provider",
                      description:
                        "Use a configured provider for spoken replies and preview.",
                    },
                  ]}
                  value={settings.ttsMode}
                  onChange={(value) => onUpdate({ ttsMode: value })}
                />

                <PickerSection>
                  <Picker
                    label="TTS Provider"
                    value={settings.ttsProvider ?? ""}
                    options={renderProviderPickerOptions(enabledTtsProviders)}
                    onChange={(value) =>
                      onUpdate({ ttsProvider: value as Provider })
                    }
                    disabled={ttsProviderPickerDisabled}
                  />
                  <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
                    {settings.ttsMode === "provider"
                      ? enabledTtsProviders.length > 0
                        ? "Only enabled providers with spoken-reply support appear here."
                        : "Enable a provider with TTS support in the Providers tab to choose it here."
                      : "Native TTS uses the system voice stack and does not require a provider key."}
                  </Text>
                </PickerSection>

                <TtsPreviewSection
                  previewText={previewText}
                  setPreviewText={setPreviewText}
                  previewLoading={previewLoading}
                  onPreview={handlePreviewVoice}
                  supportsVoicePicker={supportsOpenAiVoicePicker}
                  settings={settings}
                  onUpdate={onUpdate}
                />
              </>
            ) : null}

            {activeTab === "ui" ? (
              <RadioGroup<ThemeMode>
                label="Theme"
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ]}
                value={settings.theme}
                onChange={(value) => onUpdate({ theme: value })}
              />
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "88%",
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
    alignItems: "center",
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
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: fonts.displayHeavy,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  tabRow: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  tabButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonText: {
    fontSize: 13,
    fontFamily: fonts.display,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 14,
  },
  tabIntroText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.body,
    marginBottom: 2,
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
  apiKeyLinkButton: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  apiKeyLinkText: {
    fontSize: 13,
    fontFamily: fonts.display,
  },
  promptCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  promptLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 10,
    fontFamily: fonts.mono,
  },
  promptInput: {
    minHeight: 132,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
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
