import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  getLocalTtsVoiceOptions,
  getTtsListenLanguageLabel,
  LOCAL_TTS_SUPPORTED_LANGUAGES,
} from "../../constants/localTts";
import {
  PROVIDER_DEFAULT_TTS_VOICES,
  getProviderTtsVoiceOptions,
} from "../../constants/models";
import { useLocalization } from "../../i18n";
import { type SpeechDiagnosticRequestSummary } from "../../services/speech/diagnostics";
import {
  LocalTtsVoiceSelections,
  Provider,
  ReplyPlayback,
  Settings,
  TtsBackendMode,
  TtsListenLanguage,
} from "../../types";
import { useTheme } from "../../theme/ThemeContext";
import { Picker } from "../Picker";

import { renderProviderPickerOptions } from "./helpers";
import {
  ListenLanguageSelector,
  PickerSection,
  PreviewComposer,
  RadioGroup,
  SpeechDiagnosticsSection,
} from "./shared";
import { styles } from "./styles";
import { LocalTtsPackStates, PreviewButtonPhase, TextInputFocusHandler } from "./types";

interface TtsTabProps {
  settings: Settings;
  enabledTtsProviders: Provider[];
  ttsProviderPickerDisabled: boolean;
  ttsLanguageNote: string | null;
  selectedPreviewProvider: Provider | null;
  selectedPreviewProviderModelOptions: { id: string; name: string }[];
  selectedPreviewProviderModel: string;
  providerPreviewTexts: Record<Provider, Record<TtsListenLanguage, string>>;
  localPreviewTexts: Record<TtsListenLanguage, string>;
  activePreview: { id: string; phase: PreviewButtonPhase } | null;
  localTtsPackStates: LocalTtsPackStates;
  nativeVoiceOptions: { value: string; label: string }[];
  selectedNativeVoice: string;
  nativePreviewText: string;
  speechDiagnostics: SpeechDiagnosticRequestSummary[];
  onUpdate: (
    partial: Partial<Omit<Settings, "apiKeys" | "providerModels">>,
  ) => void;
  onUpdateProviderTtsModel: (provider: Provider, model: string) => void;
  onUpdateProviderTtsVoice: (provider: Provider, voice: string) => void;
  onUpdateLocalTtsVoice: (
    language: keyof LocalTtsVoiceSelections,
    voice: string,
  ) => void;
  onInstallLocalTtsLanguagePack: (language: TtsListenLanguage) => Promise<void>;
  onStopPreviewVoice: () => Promise<void>;
  onSetProviderPreviewText: (
    provider: Provider,
    language: TtsListenLanguage,
    text: string,
  ) => void;
  onSetLocalPreviewText: (language: TtsListenLanguage, text: string) => void;
  onSetNativePreviewText: (text: string) => void;
  onPreviewProviderVoice: (
    provider: Provider,
    previewLanguage: TtsListenLanguage,
  ) => Promise<void>;
  onPreviewLocalVoice: (language: TtsListenLanguage) => Promise<void>;
  onPreviewNativeVoice: () => Promise<void>;
  onSelectNativeVoice: (voiceId: string) => void;
  onTextInputFocus: TextInputFocusHandler;
  onToggleListenLanguage: (language: TtsListenLanguage) => void;
}

function ProviderVoicePreviewSection({
  provider,
  selectedLanguages,
  settings,
  previewTexts,
  activePreview,
  onSetPreviewText,
  onPreviewProvider,
  onStopPreview,
  onUpdateProviderTtsVoice,
  onTextInputFocus,
}: {
  provider: Provider | null;
  selectedLanguages: TtsListenLanguage[];
  settings: Settings;
  previewTexts: Record<Provider, Record<TtsListenLanguage, string>>;
  activePreview: { id: string; phase: PreviewButtonPhase } | null;
  onSetPreviewText: (
    provider: Provider,
    previewLanguage: TtsListenLanguage,
    text: string,
  ) => void;
  onPreviewProvider: (
    provider: Provider,
    previewLanguage: TtsListenLanguage,
  ) => Promise<void>;
  onStopPreview: () => Promise<void>;
  onUpdateProviderTtsVoice: (provider: Provider, voice: string) => void;
  onTextInputFocus: TextInputFocusHandler;
}) {
  const { colors } = useTheme();
  const { t, language } = useLocalization();

  if (!provider) {
    return null;
  }

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

  return (
    <PickerSection>
      <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
        {t("providerVoicePreviews")}
      </Text>
      <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
        {t("providerVoicePreviewsHint")}
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
        <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
          {provider}
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

        {selectedLanguages.map((entry, index) => {
          const previewId = `provider:${provider}:${entry}`;

          return (
            <View
              key={`${provider}:${entry}`}
              style={[
                styles.previewLanguageBlock,
                index > 0
                  ? {
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    }
                  : null,
              ]}
            >
              <Text
                style={[styles.previewLabel, { color: colors.textSecondary }]}
              >
                {getTtsListenLanguageLabel(entry, language)}
              </Text>
              <PreviewComposer
                text={previewTexts[provider][entry]}
                setText={(text) => onSetPreviewText(provider, entry, text)}
                phase={
                  activePreview?.id === previewId
                    ? activePreview.phase
                    : "idle"
                }
                interactionDisabled={
                  activePreview !== null && activePreview.id !== previewId
                }
                onPreview={() => onPreviewProvider(provider, entry)}
                onStop={onStopPreview}
                onTextInputFocus={onTextInputFocus}
              />
            </View>
          );
        })}
      </View>
    </PickerSection>
  );
}

function NativeVoicePreviewSection({
  voiceOptions,
  selectedVoice,
  previewText,
  activePreview,
  onSelectVoice,
  onSetPreviewText,
  onPreview,
  onStopPreview,
  onTextInputFocus,
}: {
  voiceOptions: { value: string; label: string }[];
  selectedVoice: string;
  previewText: string;
  activePreview: { id: string; phase: PreviewButtonPhase } | null;
  onSelectVoice: (voiceId: string) => void;
  onSetPreviewText: (text: string) => void;
  onPreview: () => Promise<void>;
  onStopPreview: () => Promise<void>;
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
              phase={
                activePreview?.id === "native"
                  ? activePreview.phase
                  : "idle"
              }
              interactionDisabled={
                activePreview !== null && activePreview.id !== "native"
              }
              onPreview={onPreview}
              onStop={onStopPreview}
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

function LocalPackSection({
  settings,
  packStates,
  onUpdateLocalTtsVoice,
  onInstallLocalTtsLanguagePack,
  localPreviewTexts,
  activePreview,
  onSetLocalPreviewText,
  onPreviewLocalVoice,
  onStopPreview,
  onTextInputFocus,
}: {
  settings: Settings;
  packStates: LocalTtsPackStates;
  onUpdateLocalTtsVoice: (
    language: keyof LocalTtsVoiceSelections,
    voice: string,
  ) => void;
  onInstallLocalTtsLanguagePack: (language: TtsListenLanguage) => Promise<void>;
  localPreviewTexts: Record<TtsListenLanguage, string>;
  activePreview: { id: string; phase: PreviewButtonPhase } | null;
  onSetLocalPreviewText: (language: TtsListenLanguage, text: string) => void;
  onPreviewLocalVoice: (language: TtsListenLanguage) => Promise<void>;
  onStopPreview: () => Promise<void>;
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
                {supported && !downloading && error ? (
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

              {supported && !downloaded ? (
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
                      {downloading ? t("downloadingShort") : t("download")}
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

            {downloaded && voiceOptions.length > 0 ? (
              <View style={styles.localPackPreview}>
                <PreviewComposer
                  text={localPreviewTexts[entry]}
                  setText={(text) => onSetLocalPreviewText(entry, text)}
                  phase={
                    activePreview?.id === `local:${entry}`
                      ? activePreview.phase
                      : "idle"
                  }
                  interactionDisabled={
                    activePreview !== null &&
                    activePreview.id !== `local:${entry}`
                  }
                  onPreview={() => onPreviewLocalVoice(entry)}
                  onStop={onStopPreview}
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

export function TtsTab({
  settings,
  enabledTtsProviders,
  ttsProviderPickerDisabled,
  ttsLanguageNote,
  selectedPreviewProvider,
  selectedPreviewProviderModelOptions,
  selectedPreviewProviderModel,
  providerPreviewTexts,
  localPreviewTexts,
  activePreview,
  localTtsPackStates,
  nativeVoiceOptions,
  selectedNativeVoice,
  nativePreviewText,
  speechDiagnostics,
  onUpdate,
  onUpdateProviderTtsModel,
  onUpdateProviderTtsVoice,
  onUpdateLocalTtsVoice,
  onInstallLocalTtsLanguagePack,
  onStopPreviewVoice,
  onSetProviderPreviewText,
  onSetLocalPreviewText,
  onSetNativePreviewText,
  onPreviewProviderVoice,
  onPreviewLocalVoice,
  onPreviewNativeVoice,
  onSelectNativeVoice,
  onTextInputFocus,
  onToggleListenLanguage,
}: TtsTabProps) {
  const { colors } = useTheme();
  const { t } = useLocalization();

  return (
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

      <ListenLanguageSelector
        selectedLanguages={settings.ttsListenLanguages}
        onToggleLanguage={onToggleListenLanguage}
      />

      <PickerSection>
        <Picker
          label={t("ttsProvider")}
          value={settings.ttsProvider ?? ""}
          options={renderProviderPickerOptions(enabledTtsProviders)}
          onChange={(value) => onUpdate({ ttsProvider: value as Provider })}
          disabled={ttsProviderPickerDisabled}
        />
        {selectedPreviewProvider &&
        selectedPreviewProviderModelOptions.length > 1 ? (
          <Picker
            label={t("model")}
            value={selectedPreviewProviderModel}
            options={selectedPreviewProviderModelOptions.map((model) => ({
              value: model.id,
              label: model.name,
            }))}
            onChange={(value) =>
              onUpdateProviderTtsModel(selectedPreviewProvider, value)
            }
          />
        ) : null}
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
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
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
            {t("providerTtsOrderHint")}
          </Text>
        ) : settings.ttsMode === "local" ? (
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
            {t("localTtsOrderHint")}
          </Text>
        ) : null}
        {ttsLanguageNote ? (
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
            {t("languageCoverage", { note: ttsLanguageNote })}
          </Text>
        ) : null}
      </PickerSection>

      <ProviderVoicePreviewSection
        provider={selectedPreviewProvider}
        selectedLanguages={settings.ttsListenLanguages}
        settings={settings}
        previewTexts={providerPreviewTexts}
        activePreview={activePreview}
        onSetPreviewText={onSetProviderPreviewText}
        onPreviewProvider={onPreviewProviderVoice}
        onStopPreview={onStopPreviewVoice}
        onUpdateProviderTtsVoice={onUpdateProviderTtsVoice}
        onTextInputFocus={onTextInputFocus}
      />
      <LocalPackSection
        settings={settings}
        packStates={localTtsPackStates}
        onUpdateLocalTtsVoice={onUpdateLocalTtsVoice}
        onInstallLocalTtsLanguagePack={onInstallLocalTtsLanguagePack}
        localPreviewTexts={localPreviewTexts}
        activePreview={activePreview}
        onSetLocalPreviewText={onSetLocalPreviewText}
        onPreviewLocalVoice={onPreviewLocalVoice}
        onStopPreview={onStopPreviewVoice}
        onTextInputFocus={onTextInputFocus}
      />
      <NativeVoicePreviewSection
        voiceOptions={nativeVoiceOptions}
        selectedVoice={selectedNativeVoice}
        previewText={nativePreviewText}
        activePreview={activePreview}
        onSelectVoice={onSelectNativeVoice}
        onSetPreviewText={onSetNativePreviewText}
        onPreview={onPreviewNativeVoice}
        onStopPreview={onStopPreviewVoice}
        onTextInputFocus={onTextInputFocus}
      />
      <SpeechDiagnosticsSection summaries={speechDiagnostics} />
    </>
  );
}
