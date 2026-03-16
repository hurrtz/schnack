import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Linking,
  Modal,
  Platform,
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
  PROVIDER_DEFAULT_TTS_VOICES,
  PROVIDER_API_KEY_URLS,
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  PROVIDER_ORDER,
  getNativeSttLanguageNote,
  getNativeTtsLanguageNote,
  getProviderApiKeyHint,
  getProviderApiKeyPlaceholder,
  getProviderSttLanguageNote,
  getProviderTtsLanguageNote,
  getProviderTtsVoiceOptions,
} from "../constants/models";
import { useLocalization } from "../i18n";
import {
  AppLanguage,
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
  onUpdateProviderTtsVoice: (provider: Provider, voice: string) => void;
  onUpdateApiKey: (provider: Provider, apiKey: string) => void;
  onPreviewVoice: (text: string) => Promise<void>;
  onClose: () => void;
}

type SettingsTab = "instructions" | "providers" | "stt" | "tts" | "ui";
type TextInputFocusHandler = NonNullable<React.ComponentProps<typeof TextInput>["onFocus"]>;

const TABS: SettingsTab[] = [
  "instructions",
  "providers",
  "stt",
  "tts",
  "ui",
];

function getTabLabel(
  tab: SettingsTab,
  t: ReturnType<typeof useLocalization>["t"]
) {
  switch (tab) {
    case "instructions":
      return t("instructions");
    case "providers":
      return t("providers");
    case "stt":
      return t("stt");
    case "tts":
      return t("tts");
    case "ui":
      return t("ui");
  }
}

function getTabDescription(
  tab: SettingsTab,
  t: ReturnType<typeof useLocalization>["t"]
) {
  switch (tab) {
    case "instructions":
      return t("instructionsTabDescription");
    case "providers":
      return t("providersTabDescription");
    case "stt":
      return t("sttTabDescription");
    case "tts":
      return t("ttsTabDescription");
    default:
      return null;
  }
}

function getResponseLengthOptions(
  t: ReturnType<typeof useLocalization>["t"]
): {
  value: AssistantResponseLength;
  label: string;
  description: string;
}[] {
  return [
    {
      value: "brief",
      label: t("brief"),
      description: t("briefDescription"),
    },
    {
      value: "normal",
      label: t("normal"),
      description: t("normalDescription"),
    },
    {
      value: "thorough",
      label: t("thorough"),
      description: t("thoroughDescription"),
    },
  ];
}

function getResponseToneOptions(
  t: ReturnType<typeof useLocalization>["t"]
): {
  value: AssistantResponseTone;
  label: string;
  description: string;
}[] {
  return [
    {
      value: "professional",
      label: t("professional"),
      description: t("professionalDescription"),
    },
    {
      value: "casual",
      label: t("casual"),
      description: t("casualDescription"),
    },
    {
      value: "nerdy",
      label: t("nerdy"),
      description: t("nerdyDescription"),
    },
    {
      value: "concise",
      label: t("concise"),
      description: t("conciseDescription"),
    },
    {
      value: "socratic",
      label: t("socratic"),
      description: t("socraticDescription"),
    },
    {
      value: "eli5",
      label: t("eli5"),
      description: t("eli5Description"),
    },
  ];
}

function getPreviewSampleText(language: AppLanguage) {
  return language === "de"
    ? "Hallo, ich bin SchnackAI."
    : "Hello, I'm SchnackAI.";
}

function TabIntro({ tab }: { tab: SettingsTab }) {
  const { colors } = useTheme();
  const { t } = useLocalization();
  const description = getTabDescription(tab, t);

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
  onTextInputFocus,
}: {
  settings: Settings;
  focusProvider?: Provider;
  onUpdateProviderModel: (provider: Provider, model: string) => void;
  onUpdateApiKey: (provider: Provider, apiKey: string) => void;
  onTextInputFocus: TextInputFocusHandler;
}) {
  const { colors } = useTheme();
  const { t, language } = useLocalization();
  const [selectedProvider, setSelectedProvider] = useState<Provider>(
    focusProvider ?? settings.lastProvider
  );
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  useEffect(() => {
    setSelectedProvider(focusProvider ?? settings.lastProvider);
  }, [focusProvider, settings.lastProvider]);

  useEffect(() => {
    setApiKeyVisible(false);
  }, [selectedProvider]);

  const handleOpenProviderPortal = React.useCallback(() => {
    void Linking.openURL(PROVIDER_API_KEY_URLS[selectedProvider]);
  }, [selectedProvider]);
  const hasApiKey = settings.apiKeys[selectedProvider].trim().length > 0;
  const secureApiKey = hasApiKey && !apiKeyVisible;

  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {t("providers")}
      </Text>
      <Text style={[styles.sectionIntro, { color: colors.textMuted }]}>
        {t("providersTabDescription")}
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
              accessibilityLabel={t("openProviderSettings", {
                provider: PROVIDER_LABELS[provider],
              })}
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
        <View
          style={[
            styles.providerStatusPill,
            {
              backgroundColor: hasApiKey ? colors.accentSoft : colors.surfaceElevated,
              borderColor: hasApiKey ? colors.borderStrong : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.providerStatusText,
              { color: hasApiKey ? colors.accent : colors.textSecondary },
            ]}
          >
            {hasApiKey ? t("configured") : t("missing")}
          </Text>
        </View>
        <Text style={[styles.apiKeyHint, { color: colors.textMuted }]}>
          {getProviderApiKeyHint(selectedProvider, language)}
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
          accessibilityLabel={t("createProviderApiKey", {
            provider: PROVIDER_LABELS[selectedProvider],
          })}
          activeOpacity={0.85}
        >
          <Text style={[styles.apiKeyLinkText, { color: colors.text }]}>
            {t("createApiKey")}
          </Text>
          <Feather name="external-link" size={14} color={colors.accent} />
        </TouchableOpacity>
        <View style={styles.apiKeyInputRow}>
          <TextInput
            value={settings.apiKeys[selectedProvider]}
            onChangeText={(value) => onUpdateApiKey(selectedProvider, value)}
            onFocus={onTextInputFocus}
            placeholder={getProviderApiKeyPlaceholder(selectedProvider, language)}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accent}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="password"
            importantForAutofill="no"
            spellCheck={false}
            secureTextEntry={secureApiKey}
            style={[
              styles.apiKeyInput,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />
          <TouchableOpacity
            style={[
              styles.apiKeyVisibilityButton,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setApiKeyVisible((previous) => !previous)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={apiKeyVisible ? t("hideKey") : t("showKey")}
          >
            <Feather
              name={apiKeyVisible ? "eye-off" : "eye"}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
        <Text style={[styles.sectionHint, { color: colors.textMuted, marginTop: 8 }]}>
          {t("apiKeyProtectedHint")}
        </Text>
        <Picker
          label={`${PROVIDER_LABELS[selectedProvider]} ${t("model")}`}
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
  onTextInputFocus,
}: {
  settings: Settings;
  onUpdate: (partial: Partial<Omit<Settings, "apiKeys" | "providerModels">>) => void;
  onTextInputFocus: TextInputFocusHandler;
}) {
  const { colors } = useTheme();
  const { t } = useLocalization();
  const responseLengthOptions = getResponseLengthOptions(t);
  const responseToneOptions = getResponseToneOptions(t);
  const selectedLength = responseLengthOptions.find(
    (option) => option.value === settings.responseLength
  );
  const selectedTone = responseToneOptions.find(
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
        {t("assistantInstructions")}
      </Text>
      <Text style={[styles.sectionIntro, { color: colors.textMuted }]}>
        {t("assistantInstructionsIntro")}
      </Text>

      <View
        style={[
          styles.promptCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.promptLabel, { color: colors.textSecondary }]}>
          {t("baseInstructions")}
        </Text>
        <TextInput
          value={settings.assistantInstructions}
          onChangeText={(value) => onUpdate({ assistantInstructions: value })}
          onFocus={onTextInputFocus}
          multiline
          placeholder={t("assistantInstructionsPlaceholder")}
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
          {t("assistantInstructionsHint")}
        </Text>
      </View>

      <Picker
        label={t("adaptiveLength")}
        value={settings.responseLength}
        options={responseLengthOptions.map((option) => ({
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
        label={t("responseTone")}
        value={settings.responseTone}
        options={responseToneOptions.map((option) => ({
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
  ttsProvider,
  voiceOptions,
  selectedVoice,
  settings,
  onUpdateProviderTtsVoice,
  onTextInputFocus,
}: {
  previewText: string;
  setPreviewText: (text: string) => void;
  previewLoading: boolean;
  onPreview: () => Promise<void>;
  ttsProvider: Provider | null;
  voiceOptions: { value: string; label: string }[];
  selectedVoice: string;
  settings: Settings;
  onUpdateProviderTtsVoice: (provider: Provider, voice: string) => void;
  onTextInputFocus: TextInputFocusHandler;
}) {
  const { colors } = useTheme();
  const { t } = useLocalization();
  const canPickProviderVoice =
    settings.ttsMode === "provider" && !!ttsProvider && voiceOptions.length > 0;

  return (
    <PickerSection>
      {canPickProviderVoice ? (
        <Picker
          label={t("ttsVoice")}
          value={selectedVoice}
          options={voiceOptions}
          onChange={(value) => onUpdateProviderTtsVoice(ttsProvider!, value)}
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
            {t("voiceSelection")}
          </Text>
          <Text style={[styles.previewHint, { color: colors.textMuted, marginTop: 0 }]}>
            {settings.ttsMode === "native"
              ? t("nativeVoiceSelectionHint")
              : t("providerDefaultVoiceHint")}
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
          {t("voicePreviewText")}
        </Text>
        <TextInput
          value={previewText}
          onChangeText={setPreviewText}
          onFocus={onTextInputFocus}
          multiline
          placeholder={t("voicePreviewPlaceholder")}
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
          {t("voicePreviewHint")}
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
              {previewLoading ? t("generatingPreview") : t("previewVoice")}
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
  onUpdateProviderTtsVoice,
  onUpdateApiKey,
  onPreviewVoice,
  onClose,
}: SettingsModalProps) {
  const { colors } = useTheme();
  const { t, language } = useLocalization();
  const insets = useSafeAreaInsets();
  const contentScrollRef = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("instructions");
  const [previewText, setPreviewText] = useState(getPreviewSampleText(language));
  const [previewLoading, setPreviewLoading] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

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

  useEffect(() => {
    if (!visible || settings.ttsMode !== "provider" || !settings.ttsProvider) {
      return;
    }

    const provider = settings.ttsProvider;
    const supportedVoices = getProviderTtsVoiceOptions(provider, language);
    const defaultVoice = PROVIDER_DEFAULT_TTS_VOICES[provider];

    if (!supportedVoices?.length || !defaultVoice) {
      return;
    }

    const currentVoice = settings.providerTtsVoices[provider];
    const isValid = supportedVoices.some((voice) => voice.id === currentVoice);

    if (!isValid) {
      onUpdateProviderTtsVoice(provider, defaultVoice);
    }
  }, [
    language,
    onUpdateProviderTtsVoice,
    settings.providerTtsVoices,
    settings.ttsMode,
    settings.ttsProvider,
    visible,
  ]);

  useEffect(() => {
    const localizedSample = getPreviewSampleText(language);

    setPreviewText((previous) =>
      previous === getPreviewSampleText("en") ||
      previous === getPreviewSampleText("de")
        ? localizedSample
        : previous
    );
  }, [language]);

  useEffect(() => {
    if (!visible) {
      setKeyboardInset(0);
      return;
    }

    const updateInset = (height: number) => {
      setKeyboardInset(Math.max(height - insets.bottom, 0));
    };

    const handleKeyboardShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => updateInset(event.endCoordinates.height)
    );
    const handleKeyboardHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => updateInset(0)
    );
    const handleKeyboardFrameChange =
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardWillChangeFrame", (event) =>
            updateInset(event.endCoordinates.height)
          )
        : null;

    return () => {
      handleKeyboardShow.remove();
      handleKeyboardHide.remove();
      handleKeyboardFrameChange?.remove();
    };
  }, [insets.bottom, visible]);

  const modalAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handleTextInputFocus = React.useCallback<TextInputFocusHandler>(
    (event) => {
      const target = Number(event.target);
      const scrollResponder = (
        contentScrollRef.current as ScrollView & {
          getScrollResponder?: () => {
            scrollResponderScrollNativeHandleToKeyboard?: (
              nodeHandle: number,
              additionalOffset?: number,
              preventNegativeScrollOffset?: boolean
            ) => void;
          };
        }
      ).getScrollResponder?.();

      if (!target || !scrollResponder?.scrollResponderScrollNativeHandleToKeyboard) {
        return;
      }

      setTimeout(() => {
        scrollResponder.scrollResponderScrollNativeHandleToKeyboard?.(
          target,
          96,
          true
        );
      }, Platform.OS === "ios" ? 80 : 40);
    },
    []
  );

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
  const sttLanguageNote =
    settings.sttMode === "native"
      ? getNativeSttLanguageNote(language)
      : settings.sttProvider
        ? getProviderSttLanguageNote(settings.sttProvider, language)
        : null;
  const ttsLanguageNote =
    settings.ttsMode === "native"
      ? getNativeTtsLanguageNote(language)
      : settings.ttsProvider
        ? getProviderTtsLanguageNote(settings.ttsProvider, language)
        : null;
  const currentTtsProvider =
    settings.ttsMode === "provider" ? settings.ttsProvider : null;
  const ttsVoiceOptions = currentTtsProvider
    ? getProviderTtsVoiceOptions(currentTtsProvider, language).map((voice) => ({
        value: voice.id,
        label: voice.label,
      }))
    : [];
  const selectedTtsVoice =
    currentTtsProvider && settings.providerTtsVoices[currentTtsProvider]
      ? settings.providerTtsVoices[currentTtsProvider]
      : currentTtsProvider
        ? PROVIDER_DEFAULT_TTS_VOICES[currentTtsProvider] ?? ""
        : "";

  return (
    <Modal visible={visible} transparent animationType="none">
      <View
        style={[
          styles.overlay,
          {
            paddingTop: Math.max(insets.top + 10, 24),
            paddingBottom: 0,
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
              <Text style={[styles.title, { color: colors.text }]}>
                {t("settings")}
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
            horizontal
            style={styles.tabScroll}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
            contentInsetAdjustmentBehavior="never"
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
                    {getTabLabel(tab, t)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView
            ref={contentScrollRef}
            style={styles.contentScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(20, keyboardInset + 20) },
            ]}
            scrollIndicatorInsets={{ bottom: keyboardInset }}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="interactive"
            nestedScrollEnabled
          >
            <TabIntro tab={activeTab} />

            {activeTab === "instructions" ? (
              <AssistantResponseSection
                settings={settings}
                onUpdate={onUpdate}
                onTextInputFocus={handleTextInputFocus}
              />
            ) : null}

            {activeTab === "providers" ? (
              <ProviderSection
                settings={settings}
                focusProvider={focusProvider}
                onUpdateProviderModel={onUpdateProviderModel}
                onUpdateApiKey={onUpdateApiKey}
                onTextInputFocus={handleTextInputFocus}
              />
            ) : null}

            {activeTab === "stt" ? (
              <>
                <RadioGroup<InputMode>
                  label={t("inputMode")}
                  options={[
                    {
                      value: "push-to-talk",
                      label: t("pushToTalk"),
                      description: t("pushToTalkDescription"),
                    },
                    {
                      value: "toggle-to-talk",
                      label: t("toggleToTalk"),
                      description: t("toggleToTalkDescription"),
                    },
                  ]}
                  value={settings.inputMode}
                  onChange={(value) => onUpdate({ inputMode: value })}
                />

                <RadioGroup<VoiceBackendMode>
                  label={t("speechToText")}
                  options={[
                    {
                      value: "native",
                      label: t("appNative"),
                      description: t("nativeSttDescription"),
                    },
                    {
                      value: "provider",
                      label: t("provider"),
                      description: t("providerSttDescription"),
                    },
                  ]}
                  value={settings.sttMode}
                  onChange={(value) => onUpdate({ sttMode: value })}
                />

                <PickerSection>
                  <Picker
                    label={t("sttProvider")}
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
                        ? t("sttProviderEnabledHint")
                        : t("sttProviderMissingHint")
                      : t("nativeSttHint")}
                  </Text>
                  {sttLanguageNote ? (
                    <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
                      {t("languageCoverage", { note: sttLanguageNote })}
                    </Text>
                  ) : null}
                </PickerSection>
              </>
            ) : null}

            {activeTab === "tts" ? (
              <>
                <RadioGroup<ReplyPlayback>
                  label={t("replyPlayback")}
                  options={[
                    {
                      value: "stream",
                      label: t("sentencesArrive"),
                      description: t("sentencesArriveDescription"),
                    },
                    {
                      value: "wait",
                      label: t("fullReplyFirst"),
                      description: t("fullReplyFirstDescription"),
                    },
                  ]}
                  value={settings.replyPlayback}
                  onChange={(value) => onUpdate({ replyPlayback: value })}
                />

                <RadioGroup<VoiceBackendMode>
                  label={t("textToSpeech")}
                  options={[
                    {
                      value: "native",
                      label: t("appNative"),
                      description: t("nativeTtsDescription"),
                    },
                    {
                      value: "provider",
                      label: t("provider"),
                      description: t("providerTtsDescription"),
                    },
                  ]}
                  value={settings.ttsMode}
                  onChange={(value) => onUpdate({ ttsMode: value })}
                />

                <PickerSection>
                  <Picker
                    label={t("ttsProvider")}
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
                        ? t("ttsProviderEnabledHint")
                        : t("ttsProviderMissingHint")
                      : t("nativeTtsHint")}
                  </Text>
                  {ttsLanguageNote ? (
                    <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
                      {t("languageCoverage", { note: ttsLanguageNote })}
                    </Text>
                  ) : null}
                </PickerSection>

                <TtsPreviewSection
                  previewText={previewText}
                  setPreviewText={setPreviewText}
                  previewLoading={previewLoading}
                  onPreview={handlePreviewVoice}
                  ttsProvider={currentTtsProvider}
                  voiceOptions={ttsVoiceOptions}
                  selectedVoice={selectedTtsVoice}
                  settings={settings}
                  onUpdateProviderTtsVoice={onUpdateProviderTtsVoice}
                  onTextInputFocus={handleTextInputFocus}
                />
              </>
            ) : null}

            {activeTab === "ui" ? (
              <>
                <RadioGroup<ThemeMode>
                  label={t("theme")}
                  options={[
                    { value: "light", label: t("light") },
                    { value: "dark", label: t("dark") },
                    { value: "system", label: t("system") },
                  ]}
                  value={settings.theme}
                  onChange={(value) => onUpdate({ theme: value })}
                />
                <PickerSection>
                  <Picker
                    label={t("language")}
                    value={settings.language}
                    options={[
                      { value: "en", label: t("english") },
                      { value: "de", label: t("german") },
                    ]}
                    onChange={(value) =>
                      onUpdate({ language: value as AppLanguage })
                    }
                  />
                </PickerSection>
              </>
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
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    flex: 1,
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
    fontFamily: fonts.display,
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
    paddingBottom: 14,
    gap: 10,
    alignItems: "center",
  },
  tabScroll: {
    flexGrow: 0,
    minHeight: 68,
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
  contentScroll: {
    flex: 1,
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
  providerStatusPill: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  providerStatusText: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
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
  apiKeyInputRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  apiKeyInput: {
    minHeight: 48,
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: fonts.body,
  },
  apiKeyVisibilityButton: {
    width: 48,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
