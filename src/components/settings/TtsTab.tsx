import React from "react";
import { Text } from "react-native";

import {
  getTtsListenLanguageLabel,
} from "../../constants/localTts";
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
  RadioGroup,
  SpeechDiagnosticsSection,
} from "./shared";
import { styles } from "./styles";
import {
  LocalPreviewTexts,
  LocalTtsPackStates,
  PreviewButtonPhase,
  ProviderPreviewTexts,
  TextInputFocusHandler,
} from "./types";
import {
  LocalPackSection,
  NativeVoicePreviewSection,
  ProviderVoicePreviewSection,
} from "./TtsSections";

interface TtsTabProps {
  settings: Settings;
  enabledTtsProviders: Provider[];
  ttsProviderPickerDisabled: boolean;
  ttsLanguageNote: string | null;
  selectedPreviewProvider: Provider | null;
  selectedPreviewProviderModelOptions: { id: string; name: string }[];
  selectedPreviewProviderModel: string;
  providerPreviewTexts: ProviderPreviewTexts;
  localPreviewTexts: LocalPreviewTexts;
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
