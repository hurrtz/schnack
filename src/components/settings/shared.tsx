import React from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  getTtsListenLanguageLabel,
  TTS_LISTEN_LANGUAGE_OPTIONS,
} from "../../constants/localTts";
import {
  PRICING_ASSUMPTIONS,
  PRICING_ASSUMPTIONS_LAST_UPDATED,
} from "../../constants/usagePricing";
import { PROVIDER_LABELS } from "../../constants/models";
import { useLocalization } from "../../i18n";
import {
  clearSpeechDiagnostics,
  type SpeechDiagnosticRequestSummary,
} from "../../services/speech/diagnostics";
import { TtsListenLanguage } from "../../types";
import { useTheme } from "../../theme/ThemeContext";

import { getTabDescription } from "./helpers";
import { styles } from "./styles";
import { PreviewButtonPhase, SettingsTab, TextInputFocusHandler } from "./types";

export function TabIntro({ tab }: { tab: SettingsTab }) {
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

export function RadioGroup<T extends string>({
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
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  const activeOption = options.find((option) => option.value === value);

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
        {options.map((option) => {
          const active = value === option.value;
          const disabled = !!option.disabled;

          return (
            <TouchableOpacity
              key={option.value}
              style={styles.radioButtonWrap}
              onPress={() => {
                if (!disabled) {
                  onChange(option.value);
                }
              }}
              activeOpacity={0.85}
              disabled={disabled}
            >
              <LinearGradient
                colors={
                  active
                    ? [colors.accentGradientStart, colors.accentGradientEnd]
                    : [colors.surface, colors.surface]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.radioButton,
                  {
                    borderColor: active ? colors.accent : colors.border,
                    opacity: disabled ? 0.55 : 1,
                  },
                  active ? styles.radioButtonActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.radioLabel,
                    active
                      ? styles.radioLabelActive
                      : { color: colors.textSecondary },
                  ]}
                >
                  {option.label}
                </Text>
              </LinearGradient>
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

export function PickerSection({ children }: { children: React.ReactNode }) {
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

export function UsagePricingReferenceSection() {
  const { colors } = useTheme();
  const { t } = useLocalization();

  return (
    <PickerSection>
      <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
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
    </PickerSection>
  );
}

export function PreviewComposer({
  text,
  setText,
  phase,
  interactionDisabled,
  onPreview,
  onStop,
  onTextInputFocus,
}: {
  text: string;
  setText: (text: string) => void;
  phase: PreviewButtonPhase;
  interactionDisabled: boolean;
  onPreview: () => Promise<void>;
  onStop: () => Promise<void>;
  onTextInputFocus: TextInputFocusHandler;
}) {
  const { colors } = useTheme();
  const { t } = useLocalization();
  const isGenerating = phase === "generating";
  const isPlaying = phase === "playing";
  const isBusy = isGenerating || isPlaying;

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
          void (isBusy ? onStop() : onPreview());
        }}
        disabled={interactionDisabled || (!isBusy && !text.trim())}
      >
        <LinearGradient
          colors={[colors.accentGradientStart, colors.accentGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.previewButton,
            !text.trim() ? styles.previewButtonDisabled : null,
            isGenerating ? styles.previewButtonBusy : null,
          ]}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="#F4F8FF" />
          ) : isPlaying ? (
            <Feather name="square" size={14} color="#F4F8FF" />
          ) : (
            <Feather name="volume-2" size={16} color="#F4F8FF" />
          )}
          <Text style={styles.previewButtonText}>
            {isBusy ? t("stop") : t("previewVoice")}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </>
  );
}

export function ListenLanguageSelector({
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

function getSpeechRouteLabel(
  route: "local" | "provider" | "native" | null,
  t: ReturnType<typeof useLocalization>["t"],
) {
  if (route === "local") {
    return t("localTts");
  }

  if (route === "provider") {
    return t("provider");
  }

  if (route === "native") {
    return t("appNative");
  }

  return "—";
}

function getSpeechSourceLabel(
  source: SpeechDiagnosticRequestSummary["source"],
  t: ReturnType<typeof useLocalization>["t"],
) {
  switch (source) {
    case "conversation":
      return t("speechDiagnosticSourceConversation");
    case "repeat":
      return t("speechDiagnosticSourceRepeat");
    case "preview":
      return t("speechDiagnosticSourcePreview");
    default:
      return t("speechDiagnosticSourceUnknown");
  }
}

function formatSpeechDiagnosticTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SpeechDiagnosticsSection({
  summaries,
}: {
  summaries: SpeechDiagnosticRequestSummary[];
}) {
  const { colors } = useTheme();
  const { t, language } = useLocalization();

  return (
    <PickerSection>
      <View style={styles.localPackHeader}>
        <View style={styles.localPackCopy}>
          <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
            {t("speechDiagnostics")}
          </Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
            {t("speechDiagnosticsHint")}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            clearSpeechDiagnostics();
          }}
        >
          <Text
            style={[styles.speechDiagnosticClear, { color: colors.accent }]}
          >
            {t("clear")}
          </Text>
        </TouchableOpacity>
      </View>

      {summaries.length === 0 ? (
        <View
          style={[
            styles.localPackCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.previewHint, { color: colors.textMuted }]}>
            {t("speechDiagnosticsEmpty")}
          </Text>
        </View>
      ) : (
        summaries.map((summary) => (
          <View
            key={summary.id}
            style={[
              styles.localPackCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.speechDiagnosticHeader}>
              <Text
                style={[styles.previewLabel, { color: colors.textSecondary }]}
              >
                {getSpeechSourceLabel(summary.source, t)}
              </Text>
              <Text style={[styles.previewHint, { color: colors.textMuted }]}>
                {formatSpeechDiagnosticTime(summary.createdAt)}
              </Text>
            </View>
            <Text
              style={[
                styles.previewHint,
                { color: colors.textSecondary, marginTop: 8 },
              ]}
            >
              {t("speechDiagnosticRouteLine", {
                requested: getSpeechRouteLabel(summary.requestedRoute, t),
                actual: getSpeechRouteLabel(
                  summary.actualRoute ?? summary.requestedRoute,
                  t,
                ),
              })}
            </Text>
            <Text style={[styles.previewHint, { color: colors.textMuted }]}>
              {t("speechDiagnosticStageLine", {
                stage: summary.latestStage,
              })}
            </Text>
            {summary.language && summary.language !== "app" ? (
              <Text style={[styles.previewHint, { color: colors.textMuted }]}>
                {t("speechDiagnosticLanguageLine", {
                  languageLabel: getTtsListenLanguageLabel(
                    summary.language,
                    language,
                  ),
                })}
              </Text>
            ) : null}
            {summary.provider ? (
              <Text style={[styles.previewHint, { color: colors.textMuted }]}>
                {t("speechDiagnosticProviderLine", {
                  provider: summary.provider,
                })}
              </Text>
            ) : null}
            {summary.voice ? (
              <Text style={[styles.previewHint, { color: colors.textMuted }]}>
                {t("speechDiagnosticVoiceLine", {
                  voice: summary.voice,
                })}
              </Text>
            ) : null}
            {summary.fallbackReason || summary.message ? (
              <Text
                style={[
                  styles.previewHint,
                  { color: colors.textMuted, marginTop: 6 },
                ]}
              >
                {summary.fallbackReason || summary.message}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </PickerSection>
  );
}
