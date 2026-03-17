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
import * as Speech from "expo-speech";
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
  getLocalTtsVoiceOptions,
  getTtsListenLanguageLabel,
  LOCAL_TTS_SUPPORTED_LANGUAGES,
  TTS_LISTEN_LANGUAGE_OPTIONS,
} from "../constants/localTts";
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
import {
  PRICING_ASSUMPTIONS,
  PRICING_ASSUMPTIONS_LAST_UPDATED,
} from "../constants/usagePricing";
import { useLocalization } from "../i18n";
import {
  AppLanguage,
  AssistantResponseLength,
  AssistantResponseTone,
  InputMode,
  LocalTtsVoiceSelections,
  Provider,
  ReplyPlayback,
  Settings,
  ThemeMode,
  SttBackendMode,
  TtsBackendMode,
  TtsListenLanguage,
  VoicePreviewRequest,
} from "../types";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import {
  getEnabledSttProviders,
  getEnabledTtsProviders,
} from "../utils/providerCapabilities";
import { Picker } from "./Picker";
import { ProviderIcon } from "./ProviderIcon";

interface SettingsModalProps {
  visible: boolean;
  settings: Settings;
  focusProvider?: Provider;
  onUpdate: (
    partial: Partial<Omit<Settings, "apiKeys" | "providerModels">>,
  ) => void;
  onUpdateProviderModel: (provider: Provider, model: string) => void;
  onUpdateProviderTtsVoice: (provider: Provider, voice: string) => void;
  onUpdateLocalTtsVoice: (
    language: keyof LocalTtsVoiceSelections,
    voice: string,
  ) => void;
  onUpdateApiKey: (provider: Provider, apiKey: string) => void;
  localTtsPackStates: Partial<
    Record<
      TtsListenLanguage,
      {
        supported: boolean;
        downloaded: boolean;
        verified: boolean;
        installed: boolean;
        downloading: boolean;
        progress: number;
        error: string | null;
      }
    >
  >;
  onInstallLocalTtsLanguagePack: (language: TtsListenLanguage) => Promise<void>;
  onPreviewVoice: (request: VoicePreviewRequest) => Promise<void>;
  onValidateProvider: (provider: Provider) => Promise<void>;
  onClose: () => void;
}

type SettingsTab = "instructions" | "providers" | "stt" | "tts" | "ui";
type TextInputFocusHandler = NonNullable<
  React.ComponentProps<typeof TextInput>["onFocus"]
>;

const TABS: SettingsTab[] = ["instructions", "providers", "stt", "tts", "ui"];

const SETTINGS_HEADER_TOP_PADDING = 22;
const SETTINGS_HEADER_BOTTOM_PADDING = 18;
const SETTINGS_HEADER_CONTROL_SIZE = 40;
const SETTINGS_HEADER_HEIGHT =
  SETTINGS_HEADER_TOP_PADDING +
  SETTINGS_HEADER_BOTTOM_PADDING +
  SETTINGS_HEADER_CONTROL_SIZE;
const SETTINGS_TAB_ROW_TOP_PADDING = 16;
const SETTINGS_TAB_ROW_BOTTOM_PADDING = 14;
const SETTINGS_TAB_BUTTON_HEIGHT = 38;
const SETTINGS_TAB_SECTION_HEIGHT =
  SETTINGS_TAB_ROW_TOP_PADDING +
  SETTINGS_TAB_ROW_BOTTOM_PADDING +
  SETTINGS_TAB_BUTTON_HEIGHT;
const SETTINGS_HERO_GLOW_HEIGHT =
  SETTINGS_HEADER_HEIGHT + SETTINGS_TAB_SECTION_HEIGHT;

type NativeSpeechVoice = Awaited<
  ReturnType<typeof Speech.getAvailableVoicesAsync>
>[number];

const PROVIDER_PREVIEW_SAMPLE_TEXT =
  "Hello. This is a longer voice preview for SchnackAI, spoken at a calm and steady pace so you can judge clarity, tone, and whether this voice feels pleasant enough for full replies. If you listen for a few seconds, you should get a realistic sense of how this provider voice will sound during everyday conversations.";

const LOCAL_PREVIEW_SAMPLE_TEXT_BY_LANGUAGE: Record<TtsListenLanguage, string> =
  {
    en: "Hello. This is a longer voice preview for SchnackAI, spoken at a calm and steady pace so you can judge clarity, tone, and whether this voice feels pleasant enough for full replies. If you listen for a few seconds, you should get a realistic sense of how this local voice will sound during everyday conversations.",
    de: "Hallo. Dies ist eine etwas laengere Sprachvorschau fuer SchnackAI, ruhig und gleichmaessig gesprochen, damit du Klarheit, Klang und Tempo besser einschaetzen kannst. Wenn du ein paar Sekunden zuhoerst, bekommst du ein gutes Gefuehl dafuer, ob sich diese Stimme fuer alltaegliche Gespraeche angenehm anhoert.",
    zh: "你好，这是 SchnackAI 的一段较长语音示例，我会用比较自然和平稳的节奏说话，方便你判断这条声音是否清晰、稳定，而且适合较长时间收听。你只要听上几秒钟，就能大致感觉到它在日常对话里听起来是不是舒服。",
    es: "Hola. Esta es una muestra de voz un poco mas larga para SchnackAI, dicha con un ritmo tranquilo y estable para que puedas juzgar con mas claridad el tono, la nitidez y lo agradable que resulta escucharla durante respuestas completas. Si escuchas unos segundos, deberias hacerte una buena idea de como sonaria esta voz en conversaciones cotidianas.",
    pt: "Ola. Esta e uma amostra de voz um pouco mais longa para o SchnackAI, falada com um ritmo calmo e estavel para que voce possa avaliar melhor a clareza, o timbre e o conforto desta voz em respostas completas. Se voce ouvir por alguns segundos, ja tera uma boa nocao de como ela soaria em conversas do dia a dia.",
    hi: "नमस्ते। यह SchnackAI के लिए एक थोड़ी लंबी आवाज़ की झलक है, जिसे शांत और स्थिर गति से बोला जा रहा है, ताकि आप स्पष्टता, लहजे और सुनने के आराम का ठीक से अंदाज़ा लगा सकें। अगर आप कुछ सेकंड ध्यान से सुनें, तो आपको अच्छी तरह महसूस हो जाएगा कि यह आवाज़ रोज़मर्रा की बातचीत में कैसी लगेगी।",
    fr: "Bonjour. Ceci est un extrait vocal un peu plus long pour SchnackAI, prononce avec un rythme calme et regulier afin que vous puissiez mieux juger la clarte, le timbre et le confort d'ecoute sur des reponses completes. En ecoutant quelques secondes, vous devriez vite sentir si cette voix convient a des conversations du quotidien.",
    it: "Ciao. Questo e un esempio vocale un po' piu lungo per SchnackAI, pronunciato con un ritmo calmo e regolare cosi puoi valutare meglio chiarezza, timbro e piacevolezza di ascolto su risposte complete. Se ascolti per qualche secondo, dovresti capire abbastanza bene come suonera questa voce nelle conversazioni di tutti i giorni.",
    ja: "こんにちは。これは SchnackAI の少し長めの音声サンプルで、聞き取りやすさや声の雰囲気、そして長めの返答でも心地よく聞けるかどうかを判断しやすいよう、落ち着いた自然な速さで話します。数秒聞いてみれば、この声が日常の会話でどのように感じられるかをかなり具体的に想像できるはずです。",
  };

function getTabLabel(
  tab: SettingsTab,
  t: ReturnType<typeof useLocalization>["t"],
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
  t: ReturnType<typeof useLocalization>["t"],
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

function getResponseLengthOptions(t: ReturnType<typeof useLocalization>["t"]): {
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

function getResponseToneOptions(t: ReturnType<typeof useLocalization>["t"]): {
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

function getLocalPreviewSampleText(language: TtsListenLanguage) {
  return LOCAL_PREVIEW_SAMPLE_TEXT_BY_LANGUAGE[language];
}

function getNativePreviewSampleText(language: AppLanguage) {
  return language === "de"
    ? "Hallo. Das ist eine kurze Sprachprobe der Systemstimme auf diesem Geraet, damit du sofort hoeren kannst, wie natuerlich oder kuenstlich sie fuer laengere Antworten wirkt. Wenn dir Tempo, Klang oder Betonung nicht gefallen, ist das ein guter Hinweis darauf, lieber eine lokale oder Cloud-Stimme zu verwenden."
    : "Hello. This is a short sample of the system voice on this device, so you can quickly hear how natural or artificial it feels for longer replies. If you dislike the pacing, tone, or pronunciation here, that is a good sign you will probably prefer a local or cloud voice instead.";
}

function getNativeVoiceOptionLabel(voice: NativeSpeechVoice) {
  return `${voice.name} · ${voice.language} · ${voice.quality}`;
}

function normalizeNativeVoices(value: unknown): NativeSpeechVoice[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is NativeSpeechVoice => {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    const candidate = entry as Partial<NativeSpeechVoice>;

    return (
      typeof candidate.identifier === "string" &&
      typeof candidate.name === "string" &&
      typeof candidate.language === "string" &&
      typeof candidate.quality === "string"
    );
  });
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
  options: {
    value: T;
    label: string;
    description?: string;
    disabled?: boolean;
  }[];
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
                  colors={[
                    colors.accentGradientStart,
                    colors.accentGradientEnd,
                  ]}
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
                    style={[styles.radioLabel, { color: colors.textSecondary }]}
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

function UsagePricingReferenceSection() {
  const { colors } = useTheme();
  const { t } = useLocalization();

  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {t("pricingAssumptions")}
      </Text>
      <Text
        style={[
          styles.sectionHint,
          styles.pricingSectionHint,
          { color: colors.textMuted },
        ]}
      >
        {t("pricingAssumptionsHint", {
          date: PRICING_ASSUMPTIONS_LAST_UPDATED,
        })}
      </Text>

      <View style={styles.pricingAssumptionList}>
        {PRICING_ASSUMPTIONS.map((assumption) => (
          <View
            key={`${assumption.provider}:${assumption.modelLabel}`}
            style={[
              styles.pricingAssumptionRow,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.pricingAssumptionCopy}>
              <Text
                style={[styles.pricingAssumptionTitle, { color: colors.text }]}
              >
                {`${PROVIDER_LABELS[assumption.provider]} · ${assumption.modelLabel}`}
              </Text>
              <Text
                style={[
                  styles.pricingAssumptionMeta,
                  { color: colors.textSecondary },
                ]}
              >
                {t("pricingAssumptionRates", {
                  input: assumption.inputUsdPerMillion.toFixed(2),
                  output: assumption.outputUsdPerMillion.toFixed(2),
                })}
              </Text>
              <Text
                style={[
                  styles.pricingAssumptionMeta,
                  { color: colors.textMuted },
                ]}
              >
                {t("pricingAssumptionCheckedAt", {
                  date: assumption.checkedAt,
                })}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.pricingSourceButton,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => {
                void Linking.openURL(assumption.sourceUrl);
              }}
              activeOpacity={0.85}
              accessibilityRole="link"
              accessibilityLabel={t("openPricingSource", {
                source: assumption.sourceLabel,
              })}
            >
              <Text
                style={[styles.pricingSourceButtonText, { color: colors.text }]}
              >
                {t("source")}
              </Text>
              <Feather name="external-link" size={14} color={colors.accent} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

function ProviderSection({
  settings,
  focusProvider,
  onUpdateProviderModel,
  onUpdateApiKey,
  onTextInputFocus,
  onValidateProvider,
}: {
  settings: Settings;
  focusProvider?: Provider;
  onUpdateProviderModel: (provider: Provider, model: string) => void;
  onUpdateApiKey: (provider: Provider, apiKey: string) => void;
  onTextInputFocus: TextInputFocusHandler;
  onValidateProvider: (provider: Provider) => Promise<void>;
}) {
  const { colors } = useTheme();
  const { t, language } = useLocalization();
  const [selectedProvider, setSelectedProvider] = useState<Provider>(
    focusProvider ?? settings.lastProvider,
  );
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [validationStateByProvider, setValidationStateByProvider] = useState<
    Partial<
      Record<
        Provider,
        {
          status: "idle" | "validating" | "success" | "error";
          message?: string;
        }
      >
    >
  >({});

  useEffect(() => {
    setSelectedProvider(focusProvider ?? settings.lastProvider);
  }, [focusProvider, settings.lastProvider]);

  useEffect(() => {
    setApiKeyVisible(false);
  }, [selectedProvider]);

  const selectedProviderApiKey = settings.apiKeys[selectedProvider];
  const selectedProviderModel = settings.providerModels[selectedProvider];

  useEffect(() => {
    setValidationStateByProvider((previous) => ({
      ...previous,
      [selectedProvider]: { status: "idle" },
    }));
  }, [selectedProvider, selectedProviderApiKey, selectedProviderModel]);

  const replyRouteLabel = t("replyModelRoute", {
    route: PROVIDER_LABELS[settings.lastProvider],
  });
  const speechInputRouteLabel = t("speechInputRoute", {
    route:
      settings.sttMode === "native"
        ? t("appNative")
        : settings.sttProvider
          ? PROVIDER_LABELS[settings.sttProvider]
          : t("noProviderYet"),
  });
  const voiceOutputRouteLabel = t("voiceOutputRoute", {
    route:
      settings.ttsMode === "native"
        ? t("systemVoice")
        : settings.ttsProvider
          ? PROVIDER_LABELS[settings.ttsProvider]
          : t("noTtsProvider"),
  });
  const setupChecklistItems = [
    {
      id: "reply",
      label: replyRouteLabel,
      ready: settings.apiKeys[settings.lastProvider].trim().length > 0,
    },
    {
      id: "stt",
      label: speechInputRouteLabel,
      ready:
        settings.sttMode === "native" ||
        (!!settings.sttProvider &&
          settings.apiKeys[settings.sttProvider].trim().length > 0),
    },
    {
      id: "tts",
      label: voiceOutputRouteLabel,
      ready:
        settings.ttsMode === "native" ||
        (!!settings.ttsProvider &&
          settings.apiKeys[settings.ttsProvider].trim().length > 0),
    },
  ];
  const setupChecklistReady = setupChecklistItems.every((item) => item.ready);

  const handleOpenProviderPortal = React.useCallback(() => {
    void Linking.openURL(PROVIDER_API_KEY_URLS[selectedProvider]);
  }, [selectedProvider]);
  const validationState = validationStateByProvider[selectedProvider] ?? {
    status: "idle" as const,
  };
  const hasApiKey = selectedProviderApiKey.trim().length > 0;
  const secureApiKey = hasApiKey && !apiKeyVisible;

  const handleValidateProviderKey = async () => {
    setValidationStateByProvider((previous) => ({
      ...previous,
      [selectedProvider]: {
        status: "validating",
      },
    }));

    try {
      await onValidateProvider(selectedProvider);
      setValidationStateByProvider((previous) => ({
        ...previous,
        [selectedProvider]: {
          status: "success",
          message: t("providerValidationSuccess", {
            provider: PROVIDER_LABELS[selectedProvider],
          }),
        },
      }));
    } catch (error) {
      setValidationStateByProvider((previous) => ({
        ...previous,
        [selectedProvider]: {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : t("providerValidationFailed"),
        },
      }));
    }
  };

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

      <View
        style={[
          styles.setupChecklistCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.setupChecklistHeader}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t("setupChecklist")}
          </Text>
          <View
            style={[
              styles.providerStatusPill,
              styles.setupChecklistStatusPill,
              {
                backgroundColor: setupChecklistReady
                  ? colors.accentSoft
                  : colors.surfaceElevated,
                borderColor: setupChecklistReady
                  ? colors.borderStrong
                  : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.providerStatusText,
                {
                  color: setupChecklistReady
                    ? colors.accent
                    : colors.textSecondary,
                },
              ]}
            >
              {setupChecklistReady ? t("configured") : t("missing")}
            </Text>
          </View>
        </View>
        <Text
          style={[
            styles.sectionHint,
            styles.setupChecklistHint,
            { color: colors.textMuted },
          ]}
        >
          {setupChecklistReady
            ? t("setupChecklistReady")
            : t("setupChecklistNeedsWork")}
        </Text>

        <View style={styles.setupChecklistList}>
          {setupChecklistItems.map((item) => (
            <View key={item.id} style={styles.setupChecklistItem}>
              <View
                style={[
                  styles.setupChecklistIcon,
                  {
                    backgroundColor: item.ready
                      ? colors.accentSoft
                      : colors.surfaceElevated,
                    borderColor: item.ready
                      ? colors.borderStrong
                      : colors.border,
                  },
                ]}
              >
                <Feather
                  name={item.ready ? "check" : "minus"}
                  size={14}
                  color={item.ready ? colors.accent : colors.textMuted}
                />
              </View>
              <View style={styles.setupChecklistCopy}>
                <Text
                  style={[styles.setupChecklistLabel, { color: colors.text }]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    styles.setupChecklistState,
                    {
                      color: item.ready ? colors.accent : colors.textSecondary,
                    },
                  ]}
                >
                  {item.ready ? t("configured") : t("missing")}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

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
              backgroundColor: hasApiKey
                ? colors.accentSoft
                : colors.surfaceElevated,
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
        <View style={styles.apiKeyActionRow}>
          <TouchableOpacity
            style={[
              styles.apiKeyLinkButton,
              styles.apiKeyActionButton,
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
          <TouchableOpacity
            style={[
              styles.apiKeyLinkButton,
              styles.apiKeyActionButton,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                opacity:
                  hasApiKey && validationState.status !== "validating"
                    ? 1
                    : 0.5,
              },
            ]}
            onPress={() => {
              void handleValidateProviderKey();
            }}
            activeOpacity={0.85}
            disabled={!hasApiKey || validationState.status === "validating"}
          >
            <Text style={[styles.apiKeyLinkText, { color: colors.text }]}>
              {validationState.status === "validating"
                ? t("validatingKey")
                : t("validateKey")}
            </Text>
            <Feather
              name={
                validationState.status === "validating"
                  ? "loader"
                  : "check-circle"
              }
              size={14}
              color={colors.accent}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.apiKeyInputRow}>
          <TextInput
            value={settings.apiKeys[selectedProvider]}
            onChangeText={(value) => onUpdateApiKey(selectedProvider, value)}
            onFocus={onTextInputFocus}
            placeholder={getProviderApiKeyPlaceholder(
              selectedProvider,
              language,
            )}
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
        <Text
          style={[
            styles.sectionHint,
            { color: colors.textMuted, marginTop: 8 },
          ]}
        >
          {t("apiKeyProtectedHint")}
        </Text>
        {validationState.status !== "idle" && validationState.message ? (
          <View
            style={[
              styles.validationCard,
              {
                backgroundColor:
                  validationState.status === "success"
                    ? colors.accentSoft
                    : colors.surfaceElevated,
                borderColor:
                  validationState.status === "success"
                    ? colors.borderStrong
                    : validationState.status === "error"
                      ? colors.danger
                      : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.validationText,
                {
                  color:
                    validationState.status === "success"
                      ? colors.accent
                      : validationState.status === "error"
                        ? colors.danger
                        : colors.textSecondary,
                },
              ]}
            >
              {validationState.message}
            </Text>
          </View>
        ) : null}
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
  onUpdate: (
    partial: Partial<Omit<Settings, "apiKeys" | "providerModels">>,
  ) => void;
  onTextInputFocus: TextInputFocusHandler;
}) {
  const { colors } = useTheme();
  const { t } = useLocalization();
  const responseLengthOptions = getResponseLengthOptions(t);
  const responseToneOptions = getResponseToneOptions(t);
  const selectedLength = responseLengthOptions.find(
    (option) => option.value === settings.responseLength,
  );
  const selectedTone = responseToneOptions.find(
    (option) => option.value === settings.responseTone,
  );

  return (
    <>
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
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
      </View>

      <PickerSection>
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
      </PickerSection>

      <PickerSection>
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
      </PickerSection>
    </>
  );
}

function PreviewComposer({
  text,
  setText,
  loading,
  onPreview,
  onTextInputFocus,
}: {
  text: string;
  setText: (text: string) => void;
  loading: boolean;
  onPreview: () => Promise<void>;
  onTextInputFocus: TextInputFocusHandler;
}) {
  const { colors } = useTheme();
  const { t } = useLocalization();

  return (
    <>
      <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
        {t("voicePreviewText")}
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
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
        disabled={loading || !text.trim()}
      >
        <LinearGradient
          colors={[colors.accentGradientStart, colors.accentGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.previewButton,
            !text.trim() || loading ? styles.previewButtonDisabled : null,
          ]}
        >
          <Feather
            name={loading ? "loader" : "volume-2"}
            size={16}
            color="#F4F8FF"
          />
          <Text style={styles.previewButtonText}>
            {loading ? t("generatingPreview") : t("previewVoice")}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </>
  );
}

function ProviderVoicePreviewSection({
  providers,
  settings,
  previewTexts,
  activePreviewId,
  onSetPreviewText,
  onPreviewProvider,
  onUpdateProviderTtsVoice,
  onTextInputFocus,
}: {
  providers: Provider[];
  settings: Settings;
  previewTexts: Record<Provider, string>;
  activePreviewId: string | null;
  onSetPreviewText: (provider: Provider, text: string) => void;
  onPreviewProvider: (provider: Provider) => Promise<void>;
  onUpdateProviderTtsVoice: (provider: Provider, voice: string) => void;
  onTextInputFocus: TextInputFocusHandler;
}) {
  const { colors } = useTheme();
  const { t, language } = useLocalization();

  if (providers.length === 0) {
    return null;
  }

  return (
    <PickerSection>
      <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
        {t("providerVoicePreviews")}
      </Text>
      <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
        {t("providerVoicePreviewsHint")}
      </Text>

      {providers.map((provider) => {
        const voiceOptions = getProviderTtsVoiceOptions(provider, language).map(
          (voice) => ({
            value: voice.id,
            label: voice.label,
          }),
        );
        const selectedVoice =
          settings.providerTtsVoices[provider] ||
          PROVIDER_DEFAULT_TTS_VOICES[provider] ||
          voiceOptions[0]?.value ||
          "";
        const previewId = `provider:${provider}`;

        return (
          <View
            key={provider}
            style={[
              styles.localPackCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[styles.previewLabel, { color: colors.textSecondary }]}
            >
              {PROVIDER_LABELS[provider]}
            </Text>
            {voiceOptions.length > 0 ? (
              <Picker
                label={t("ttsVoice")}
                value={selectedVoice}
                options={voiceOptions}
                onChange={(value) => onUpdateProviderTtsVoice(provider, value)}
              />
            ) : (
              <Text
                style={[
                  styles.previewHint,
                  { color: colors.textMuted, marginTop: 0 },
                ]}
              >
                {t("providerDefaultVoiceHint")}
              </Text>
            )}
            <PreviewComposer
              text={previewTexts[provider]}
              setText={(text) => onSetPreviewText(provider, text)}
              loading={activePreviewId === previewId}
              onPreview={() => onPreviewProvider(provider)}
              onTextInputFocus={onTextInputFocus}
            />
          </View>
        );
      })}
    </PickerSection>
  );
}

function NativeVoicePreviewSection({
  voiceOptions,
  selectedVoice,
  previewText,
  activePreviewId,
  onSelectVoice,
  onSetPreviewText,
  onPreview,
  onTextInputFocus,
}: {
  voiceOptions: { value: string; label: string }[];
  selectedVoice: string;
  previewText: string;
  activePreviewId: string | null;
  onSelectVoice: (voiceId: string) => void;
  onSetPreviewText: (text: string) => void;
  onPreview: () => Promise<void>;
  onTextInputFocus: TextInputFocusHandler;
}) {
  const { colors } = useTheme();
  const { t } = useLocalization();

  return (
    <PickerSection>
      <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
        {t("nativeVoicePreviewSection")}
      </Text>
      <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
        {t("nativeVoicePreviewSectionHint")}
      </Text>

      <View
        style={[
          styles.localPackCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {voiceOptions.length > 0 ? (
          <>
            <Picker
              label={t("ttsVoice")}
              value={selectedVoice}
              options={voiceOptions}
              onChange={onSelectVoice}
            />
            <PreviewComposer
              text={previewText}
              setText={onSetPreviewText}
              loading={activePreviewId === "native"}
              onPreview={onPreview}
              onTextInputFocus={onTextInputFocus}
            />
          </>
        ) : (
          <Text
            style={[
              styles.previewHint,
              { color: colors.textMuted, marginTop: 0 },
            ]}
          >
            {t("nativeVoiceUnavailable")}
          </Text>
        )}
      </View>
    </PickerSection>
  );
}

function ListenLanguageSelector({
  selectedLanguages,
  onToggleLanguage,
}: {
  selectedLanguages: TtsListenLanguage[];
  onToggleLanguage: (language: TtsListenLanguage) => void;
}) {
  const { colors } = useTheme();
  const { t, language } = useLocalization();

  return (
    <PickerSection>
      <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
        {t("listenLanguages")}
      </Text>
      <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
        {t("listenLanguagesHint")}
      </Text>
      <View style={styles.languageChipRow}>
        {TTS_LISTEN_LANGUAGE_OPTIONS.map((entry) => {
          const selected = selectedLanguages.includes(entry);

          return (
            <Pressable
              key={entry}
              onPress={() => onToggleLanguage(entry)}
              style={[
                styles.languageChip,
                {
                  backgroundColor: selected
                    ? colors.accentSoft
                    : colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.languageChipText,
                  { color: selected ? colors.accent : colors.textSecondary },
                ]}
              >
                {getTtsListenLanguageLabel(entry, language)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </PickerSection>
  );
}

function LocalPackSection({
  settings,
  packStates,
  onUpdateLocalTtsVoice,
  onInstallLocalTtsLanguagePack,
  localPreviewTexts,
  activePreviewId,
  onSetLocalPreviewText,
  onPreviewLocalVoice,
  onTextInputFocus,
}: {
  settings: Settings;
  packStates: Partial<
    Record<
      TtsListenLanguage,
      {
        supported: boolean;
        downloaded: boolean;
        verified: boolean;
        installed: boolean;
        downloading: boolean;
        progress: number;
        error: string | null;
      }
    >
  >;
  onUpdateLocalTtsVoice: (
    language: keyof LocalTtsVoiceSelections,
    voice: string,
  ) => void;
  onInstallLocalTtsLanguagePack: (language: TtsListenLanguage) => Promise<void>;
  localPreviewTexts: Record<TtsListenLanguage, string>;
  activePreviewId: string | null;
  onSetLocalPreviewText: (language: TtsListenLanguage, text: string) => void;
  onPreviewLocalVoice: (language: TtsListenLanguage) => Promise<void>;
  onTextInputFocus: TextInputFocusHandler;
}) {
  const { colors } = useTheme();
  const { t, language } = useLocalization();

  return (
    <PickerSection>
      <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
        {t("localVoicePacks")}
      </Text>
      <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
        {t("localVoicePacksHint")}
      </Text>

      {settings.ttsListenLanguages.map((entry) => {
        const state = packStates[entry];
        const supported =
          state?.supported ?? LOCAL_TTS_SUPPORTED_LANGUAGES.includes(entry);
        const downloaded = state?.downloaded ?? false;
        const verified = state?.verified ?? false;
        const installed = state?.installed ?? false;
        const downloading = state?.downloading ?? false;
        const progress = state?.progress ?? 0;
        const error = state?.error ?? null;
        const voiceOptions = getLocalTtsVoiceOptions(entry);
        const selectedVoice =
          settings.localTtsVoices[entry] || voiceOptions[0]?.value || "";

        return (
          <View
            key={entry}
            style={[
              styles.localPackCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.localPackHeader}>
              <View style={styles.localPackCopy}>
                <Text
                  style={[styles.previewLabel, { color: colors.textSecondary }]}
                >
                  {getTtsListenLanguageLabel(entry, language)}
                </Text>
                <Text
                  style={[
                    styles.previewHint,
                    { color: colors.textMuted, marginTop: 4 },
                  ]}
                >
                  {supported
                    ? downloading
                      ? t("downloadingLocalTtsPack", {
                          progress: `${Math.round(progress * 100)}`,
                        })
                      : installed
                        ? t("localTtsPackReady")
                        : downloaded
                          ? t("localTtsPackBroken")
                          : t("localTtsPackMissing")
                    : t("localTtsUnsupportedLanguageFallback")}
                </Text>
                {supported && downloaded && !verified && error ? (
                  <Text
                    style={[
                      styles.previewHint,
                      { color: colors.textMuted, marginTop: 4 },
                    ]}
                  >
                    {error}
                  </Text>
                ) : null}
              </View>

              {supported && !installed ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    void onInstallLocalTtsLanguagePack(entry);
                  }}
                  disabled={downloading}
                >
                  <LinearGradient
                    colors={[
                      colors.accentGradientStart,
                      colors.accentGradientEnd,
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.localPackButton,
                      downloading ? styles.previewButtonDisabled : null,
                    ]}
                  >
                    <Feather
                      name={downloading ? "loader" : "download-cloud"}
                      size={16}
                      color="#F4F8FF"
                    />
                    <Text style={styles.localPackButtonText}>
                      {downloading
                        ? t("downloadingShort")
                        : downloaded
                          ? t("retry")
                          : t("download")}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : null}
            </View>

            {voiceOptions.length > 0 ? (
              <View style={styles.localPackVoicePicker}>
                <Picker
                  label={t("localVoiceForLanguage", {
                    languageLabel: getTtsListenLanguageLabel(entry, language),
                  })}
                  value={selectedVoice}
                  options={voiceOptions}
                  onChange={(value) => onUpdateLocalTtsVoice(entry, value)}
                />
              </View>
            ) : null}

            {installed && voiceOptions.length > 0 ? (
              <View style={styles.localPackPreview}>
                <PreviewComposer
                  text={localPreviewTexts[entry]}
                  setText={(text) => onSetLocalPreviewText(entry, text)}
                  loading={activePreviewId === `local:${entry}`}
                  onPreview={() => onPreviewLocalVoice(entry)}
                  onTextInputFocus={onTextInputFocus}
                />
              </View>
            ) : null}
          </View>
        );
      })}
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
  onUpdateLocalTtsVoice,
  onUpdateApiKey,
  localTtsPackStates,
  onInstallLocalTtsLanguagePack,
  onPreviewVoice,
  onValidateProvider,
  onClose,
}: SettingsModalProps) {
  const { colors } = useTheme();
  const { t, language } = useLocalization();
  const insets = useSafeAreaInsets();
  const contentScrollRef = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("instructions");
  const [providerPreviewTexts, setProviderPreviewTexts] = useState<
    Record<Provider, string>
  >(() =>
    PROVIDER_ORDER.reduce(
      (accumulator, provider) => ({
        ...accumulator,
        [provider]: PROVIDER_PREVIEW_SAMPLE_TEXT,
      }),
      {} as Record<Provider, string>,
    ),
  );
  const [localPreviewTexts, setLocalPreviewTexts] = useState<
    Record<TtsListenLanguage, string>
  >(() =>
    TTS_LISTEN_LANGUAGE_OPTIONS.reduce(
      (accumulator, option) => ({
        ...accumulator,
        [option]: getLocalPreviewSampleText(option),
      }),
      {} as Record<TtsListenLanguage, string>,
    ),
  );
  const [nativePreviewText, setNativePreviewText] = useState(
    getNativePreviewSampleText(language),
  );
  const [nativeVoices, setNativeVoices] = useState<NativeSpeechVoice[]>([]);
  const [selectedNativeVoice, setSelectedNativeVoice] = useState("");
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const enabledSttProviders = useMemo(
    () => getEnabledSttProviders(settings),
    [settings],
  );
  const enabledTtsProviders = useMemo(
    () => getEnabledTtsProviders(settings),
    [settings],
  );

  const scale = useSharedValue(0.96);
  const translateY = useSharedValue(16);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scale.value = 0.96;
      translateY.value = 16;
      opacity.value = 0;
      setActivePreviewId(null);
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
        : (enabledSttProviders[0] ?? null);

    if (nextProvider !== settings.sttProvider) {
      onUpdate({ sttProvider: nextProvider });
    }
  }, [
    enabledSttProviders,
    onUpdate,
    settings.sttMode,
    settings.sttProvider,
    visible,
  ]);

  useEffect(() => {
    if (!visible || settings.ttsMode === "native") {
      return;
    }

    const nextProvider =
      settings.ttsProvider && enabledTtsProviders.includes(settings.ttsProvider)
        ? settings.ttsProvider
        : (enabledTtsProviders[0] ?? null);

    if (nextProvider !== settings.ttsProvider) {
      onUpdate({ ttsProvider: nextProvider });
    }
  }, [
    enabledTtsProviders,
    onUpdate,
    settings.ttsMode,
    settings.ttsProvider,
    visible,
  ]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextProviderTtsVoices = { ...settings.providerTtsVoices };
    let hasInvalidSelection = false;

    for (const provider of enabledTtsProviders) {
      const supportedVoices = getProviderTtsVoiceOptions(provider, language);
      const defaultVoice =
        PROVIDER_DEFAULT_TTS_VOICES[provider] || supportedVoices[0]?.id;

      if (!supportedVoices.length || !defaultVoice) {
        continue;
      }

      const currentVoice = nextProviderTtsVoices[provider];
      const isValid = supportedVoices.some(
        (voice) => voice.id === currentVoice,
      );

      if (!isValid) {
        nextProviderTtsVoices[provider] = defaultVoice;
        hasInvalidSelection = true;
      }
    }

    if (hasInvalidSelection) {
      onUpdate({ providerTtsVoices: nextProviderTtsVoices });
    }
  }, [
    enabledTtsProviders,
    language,
    onUpdate,
    settings.providerTtsVoices,
    visible,
  ]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextLocalTtsVoices = { ...settings.localTtsVoices };
    let hasInvalidSelection = false;

    for (const selectedLanguage of settings.ttsListenLanguages) {
      const voiceOptions = getLocalTtsVoiceOptions(selectedLanguage);

      if (voiceOptions.length === 0) {
        continue;
      }

      const currentVoice = nextLocalTtsVoices[selectedLanguage];
      const isValid = voiceOptions.some(
        (option) => option.value === currentVoice,
      );

      if (!isValid) {
        nextLocalTtsVoices[selectedLanguage] = voiceOptions[0].value;
        hasInvalidSelection = true;
      }
    }

    if (hasInvalidSelection) {
      onUpdate({ localTtsVoices: nextLocalTtsVoices });
    }
  }, [onUpdate, settings.localTtsVoices, settings.ttsListenLanguages, visible]);

  useEffect(() => {
    const localizedSample = getNativePreviewSampleText(language);

    setNativePreviewText((previous) =>
      previous === getNativePreviewSampleText("en") ||
      previous === getNativePreviewSampleText("de")
        ? localizedSample
        : previous,
    );
  }, [language]);

  useEffect(() => {
    if (!visible || activeTab !== "tts") {
      return;
    }

    let cancelled = false;
    const preferredLanguagePrefix = language === "de" ? "de" : "en";

    void Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (cancelled) {
          return;
        }

        const sortedVoices = normalizeNativeVoices(voices).sort(
          (left, right) => {
            const leftLanguage = left.language.toLowerCase();
            const rightLanguage = right.language.toLowerCase();
            const leftLanguageMatches = leftLanguage.startsWith(
              preferredLanguagePrefix,
            );
            const rightLanguageMatches = rightLanguage.startsWith(
              preferredLanguagePrefix,
            );

            if (leftLanguageMatches !== rightLanguageMatches) {
              return leftLanguageMatches ? -1 : 1;
            }

            if (left.quality !== right.quality) {
              return left.quality === "Enhanced" ? -1 : 1;
            }

            const languageComparison = left.language.localeCompare(
              right.language,
            );

            if (languageComparison !== 0) {
              return languageComparison;
            }

            return left.name.localeCompare(right.name);
          },
        );

        setNativeVoices(sortedVoices);
        setSelectedNativeVoice((previous) => {
          if (
            previous &&
            sortedVoices.some((voice) => voice.identifier === previous)
          ) {
            return previous;
          }

          return sortedVoices[0]?.identifier ?? "";
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setNativeVoices([]);
        setSelectedNativeVoice("");
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, language, visible]);

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
      (event) => updateInset(event.endCoordinates.height),
    );
    const handleKeyboardHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => updateInset(0),
    );
    const handleKeyboardFrameChange =
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardWillChangeFrame", (event) =>
            updateInset(event.endCoordinates.height),
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
              preventNegativeScrollOffset?: boolean,
            ) => void;
          };
        }
      ).getScrollResponder?.();

      if (
        !target ||
        !scrollResponder?.scrollResponderScrollNativeHandleToKeyboard
      ) {
        return;
      }

      setTimeout(
        () => {
          scrollResponder.scrollResponderScrollNativeHandleToKeyboard?.(
            target,
            96,
            true,
          );
        },
        Platform.OS === "ios" ? 80 : 40,
      );
    },
    [],
  );

  const handleExactPreview = async (
    previewId: string,
    request: VoicePreviewRequest,
  ) => {
    const trimmed = request.text.trim();

    if (!trimmed || activePreviewId) {
      return;
    }

    setActivePreviewId(previewId);
    try {
      await onPreviewVoice({
        ...request,
        text: trimmed,
      });
    } finally {
      setActivePreviewId(null);
    }
  };

  const handlePreviewLocalVoice = async (
    selectedLanguage: TtsListenLanguage,
  ) => {
    const selectedVoice =
      settings.localTtsVoices[selectedLanguage] ||
      getLocalTtsVoiceOptions(selectedLanguage)[0]?.value ||
      "";

    await handleExactPreview(`local:${selectedLanguage}`, {
      text: localPreviewTexts[selectedLanguage],
      mode: "local",
      localLanguage: selectedLanguage,
      voice: selectedVoice,
    });
  };

  const handlePreviewProviderVoice = async (provider: Provider) => {
    const selectedVoice =
      settings.providerTtsVoices[provider] ||
      PROVIDER_DEFAULT_TTS_VOICES[provider] ||
      getProviderTtsVoiceOptions(provider, language)[0]?.id ||
      "";

    await handleExactPreview(`provider:${provider}`, {
      text: providerPreviewTexts[provider],
      mode: "provider",
      provider,
      voice: selectedVoice,
    });
  };

  const handlePreviewNativeVoice = async () => {
    await handleExactPreview("native", {
      text: nativePreviewText,
      mode: "native",
      nativeVoice: selectedNativeVoice || undefined,
    });
  };

  const providerPickerDisabled =
    settings.sttMode !== "provider" || enabledSttProviders.length === 0;
  const ttsProviderPickerDisabled =
    settings.ttsMode === "native" || enabledTtsProviders.length === 0;
  const sttLanguageNote =
    settings.sttMode === "native"
      ? getNativeSttLanguageNote(language)
      : settings.sttProvider
        ? getProviderSttLanguageNote(settings.sttProvider, language)
        : null;
  const ttsLanguageNote =
    settings.ttsMode === "native"
      ? getNativeTtsLanguageNote(language)
      : settings.ttsMode === "local"
        ? t("localTtsLanguageCoverageHint")
        : settings.ttsProvider
          ? getProviderTtsLanguageNote(settings.ttsProvider, language)
          : null;
  const nativeVoiceOptions = nativeVoices.map((voice) => ({
    value: voice.identifier,
    label: getNativeVoiceOptionLabel(voice),
  }));
  const toggleListenLanguage = (value: TtsListenLanguage) => {
    const exists = settings.ttsListenLanguages.includes(value);

    if (exists && settings.ttsListenLanguages.length === 1) {
      return;
    }

    onUpdate({
      ttsListenLanguages: exists
        ? settings.ttsListenLanguages.filter((entry) => entry !== value)
        : [...settings.ttsListenLanguages, value],
    });
  };

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
                onValidateProvider={onValidateProvider}
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

                <RadioGroup<SttBackendMode>
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
                  <Text
                    style={[styles.sectionHint, { color: colors.textMuted }]}
                  >
                    {settings.sttMode === "provider"
                      ? enabledSttProviders.length > 0
                        ? t("sttProviderEnabledHint")
                        : t("sttProviderMissingHint")
                      : t("nativeSttHint")}
                  </Text>
                  {sttLanguageNote ? (
                    <Text
                      style={[styles.sectionHint, { color: colors.textMuted }]}
                    >
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

                <RadioGroup<TtsBackendMode>
                  label={t("textToSpeech")}
                  options={[
                    {
                      value: "native",
                      label: t("appNative"),
                      description: t("nativeTtsDescription"),
                    },
                    {
                      value: "local",
                      label: t("localTts"),
                      description: t("localTtsDescription"),
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
                  <Text
                    style={[styles.sectionHint, { color: colors.textMuted }]}
                  >
                    {settings.ttsMode === "provider"
                      ? enabledTtsProviders.length > 0
                        ? t("ttsProviderEnabledHint")
                        : t("ttsProviderMissingHint")
                      : settings.ttsMode === "local"
                        ? enabledTtsProviders.length > 0
                          ? t("ttsProviderEnabledHint")
                          : t("ttsProviderMissingHint")
                        : t("nativeTtsHint")}
                  </Text>
                  {settings.ttsMode === "provider" ? (
                    <Text
                      style={[styles.sectionHint, { color: colors.textMuted }]}
                    >
                      {t("providerTtsOrderHint")}
                    </Text>
                  ) : settings.ttsMode === "local" ? (
                    <Text
                      style={[styles.sectionHint, { color: colors.textMuted }]}
                    >
                      {t("localTtsOrderHint")}
                    </Text>
                  ) : null}
                  {ttsLanguageNote ? (
                    <Text
                      style={[styles.sectionHint, { color: colors.textMuted }]}
                    >
                      {t("languageCoverage", { note: ttsLanguageNote })}
                    </Text>
                  ) : null}
                </PickerSection>

                <ListenLanguageSelector
                  selectedLanguages={settings.ttsListenLanguages}
                  onToggleLanguage={toggleListenLanguage}
                />
                <LocalPackSection
                  settings={settings}
                  packStates={localTtsPackStates}
                  onUpdateLocalTtsVoice={onUpdateLocalTtsVoice}
                  onInstallLocalTtsLanguagePack={onInstallLocalTtsLanguagePack}
                  localPreviewTexts={localPreviewTexts}
                  activePreviewId={activePreviewId}
                  onSetLocalPreviewText={(selectedLanguage, text) => {
                    setLocalPreviewTexts((previous) => ({
                      ...previous,
                      [selectedLanguage]: text,
                    }));
                  }}
                  onPreviewLocalVoice={handlePreviewLocalVoice}
                  onTextInputFocus={handleTextInputFocus}
                />
                <ProviderVoicePreviewSection
                  providers={enabledTtsProviders}
                  settings={settings}
                  previewTexts={providerPreviewTexts}
                  activePreviewId={activePreviewId}
                  onSetPreviewText={(provider, text) => {
                    setProviderPreviewTexts((previous) => ({
                      ...previous,
                      [provider]: text,
                    }));
                  }}
                  onPreviewProvider={handlePreviewProviderVoice}
                  onUpdateProviderTtsVoice={onUpdateProviderTtsVoice}
                  onTextInputFocus={handleTextInputFocus}
                />
                <NativeVoicePreviewSection
                  voiceOptions={nativeVoiceOptions}
                  selectedVoice={selectedNativeVoice}
                  previewText={nativePreviewText}
                  activePreviewId={activePreviewId}
                  onSelectVoice={setSelectedNativeVoice}
                  onSetPreviewText={setNativePreviewText}
                  onPreview={handlePreviewNativeVoice}
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
                <RadioGroup<"show" | "hide">
                  label={t("usageStats")}
                  options={[
                    {
                      value: "hide",
                      label: t("hide"),
                      description: t("usageStatsHiddenDescription"),
                    },
                    {
                      value: "show",
                      label: t("show"),
                      description: t("usageStatsVisibleDescription"),
                    },
                  ]}
                  value={settings.showUsageStats ? "show" : "hide"}
                  onChange={(value) =>
                    onUpdate({ showUsageStats: value === "show" })
                  }
                />
                <UsagePricingReferenceSection />
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
    height: SETTINGS_HERO_GLOW_HEIGHT,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 22,
    paddingTop: SETTINGS_HEADER_TOP_PADDING,
    paddingBottom: SETTINGS_HEADER_BOTTOM_PADDING,
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
    width: SETTINGS_HEADER_CONTROL_SIZE,
    height: SETTINGS_HEADER_CONTROL_SIZE,
    borderRadius: SETTINGS_HEADER_CONTROL_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  tabRow: {
    paddingHorizontal: 18,
    paddingTop: SETTINGS_TAB_ROW_TOP_PADDING,
    paddingBottom: SETTINGS_TAB_ROW_BOTTOM_PADDING,
    gap: 10,
    alignItems: "center",
  },
  tabScroll: {
    flexGrow: 0,
    minHeight: SETTINGS_TAB_SECTION_HEIGHT,
  },
  tabButton: {
    minHeight: SETTINGS_TAB_BUTTON_HEIGHT,
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
  pricingSectionHint: {
    marginTop: 0,
    marginBottom: 12,
  },
  pricingAssumptionList: {
    gap: 10,
  },
  pricingAssumptionRow: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  pricingAssumptionCopy: {
    gap: 4,
  },
  pricingAssumptionTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.display,
  },
  pricingAssumptionMeta: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.mono,
  },
  pricingSourceButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pricingSourceButtonText: {
    fontSize: 12,
    fontFamily: fonts.body,
  },
  providerButtonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  setupChecklistCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  setupChecklistHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  setupChecklistStatusPill: {
    marginTop: 0,
  },
  setupChecklistHint: {
    marginTop: 0,
  },
  setupChecklistList: {
    marginTop: 12,
    gap: 10,
  },
  setupChecklistItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  setupChecklistIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  setupChecklistCopy: {
    flex: 1,
    gap: 2,
  },
  setupChecklistLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  setupChecklistState: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
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
  apiKeyActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  apiKeyActionButton: {
    flex: 1,
  },
  apiKeyLinkText: {
    fontSize: 13,
    fontFamily: fonts.display,
  },
  validationCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  validationText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
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
  groupLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 8,
    fontFamily: fonts.mono,
  },
  languageChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  languageChip: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  languageChipText: {
    fontSize: 13,
    fontFamily: fonts.display,
  },
  localPackCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginTop: 10,
  },
  localPackHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  localPackCopy: {
    flex: 1,
  },
  localPackVoicePicker: {
    marginTop: 14,
  },
  localPackPreview: {
    marginTop: 14,
  },
  localPackButton: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  localPackButtonText: {
    color: "#F4F8FF",
    fontSize: 13,
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
