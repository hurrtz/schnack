import { useLocalization } from "../../i18n";
import { PROVIDER_LABELS } from "../../constants/models";
import {
  AppLanguage,
  AssistantResponseLength,
  AssistantResponseTone,
  Provider,
  ResponseMode,
  TtsListenLanguage,
} from "../../types";
import {
  LOCAL_PREVIEW_SAMPLE_TEXT_BY_LANGUAGE,
  PROVIDER_PREVIEW_SAMPLE_TEXT_BY_LANGUAGE,
  getNativePreviewSampleText,
} from "../../constants/voicePreviewSamples";

import { NativeSpeechVoice, SettingsTab } from "./types";

export function getTabLabel(
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

export function getTabDescription(
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

export function getResponseLengthOptions(
  t: ReturnType<typeof useLocalization>["t"],
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

export function getResponseToneOptions(
  t: ReturnType<typeof useLocalization>["t"],
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

export function getResponseModeLabel(
  mode: ResponseMode,
  t: ReturnType<typeof useLocalization>["t"],
) {
  switch (mode) {
    case "quick":
      return t("quickAndShallow");
    case "normal":
      return t("normal");
    case "deep":
      return t("deepThinking");
  }
}

export function getResponseModeDescription(
  mode: ResponseMode,
  t: ReturnType<typeof useLocalization>["t"],
) {
  switch (mode) {
    case "quick":
      return t("quickModeDescription");
    case "normal":
      return t("normalModeDescription");
    case "deep":
      return t("deepModeDescription");
  }
}

export function getLocalPreviewSampleText(language: TtsListenLanguage) {
  return LOCAL_PREVIEW_SAMPLE_TEXT_BY_LANGUAGE[language];
}

export function getProviderPreviewSampleText(language: TtsListenLanguage) {
  return PROVIDER_PREVIEW_SAMPLE_TEXT_BY_LANGUAGE[language];
}

export { getNativePreviewSampleText };

export function getNativeVoiceOptionLabel(voice: NativeSpeechVoice) {
  return `${voice.name} · ${voice.language} · ${voice.quality}`;
}

export function normalizeNativeVoices(value: unknown): NativeSpeechVoice[] {
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

export function renderProviderPickerOptions(providers: Provider[]) {
  return providers.map((provider) => ({
    value: provider,
    label: PROVIDER_LABELS[provider],
  }));
}
