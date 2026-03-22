import { useCallback, useEffect, useState } from "react";

import { TTS_LISTEN_LANGUAGE_OPTIONS } from "../../constants/localTts";
import { AppLanguage, Provider, Settings, TtsListenLanguage } from "../../types";

import {
  getLocalPreviewSampleText,
  getNativePreviewSampleText,
  getProviderPreviewSampleText,
} from "./helpers";
import { LocalPreviewTexts, ProviderPreviewTexts } from "./types";

function buildProviderPreviewTexts(settings: Settings): ProviderPreviewTexts {
  return Object.fromEntries(
    (Object.keys(settings.apiKeys) as Provider[]).map((provider) => [
      provider,
      Object.fromEntries(
        TTS_LISTEN_LANGUAGE_OPTIONS.map((entry) => [
          entry,
          getProviderPreviewSampleText(entry),
        ]),
      ),
    ]),
  ) as ProviderPreviewTexts;
}

function buildLocalPreviewTexts(): LocalPreviewTexts {
  return Object.fromEntries(
    TTS_LISTEN_LANGUAGE_OPTIONS.map((entry) => [
      entry,
      getLocalPreviewSampleText(entry),
    ]),
  ) as LocalPreviewTexts;
}

export function usePreviewTextState(params: {
  settings: Settings;
  language: AppLanguage;
}) {
  const { settings, language } = params;
  const [providerPreviewTexts, setProviderPreviewTexts] =
    useState<ProviderPreviewTexts>(() => buildProviderPreviewTexts(settings));
  const [localPreviewTexts, setLocalPreviewTexts] = useState<LocalPreviewTexts>(
    () => buildLocalPreviewTexts(),
  );
  const [nativePreviewText, setNativePreviewText] = useState(() =>
    getNativePreviewSampleText(language),
  );

  useEffect(() => {
    const localizedSample = getNativePreviewSampleText(language);

    setNativePreviewText((previous) =>
      previous === getNativePreviewSampleText("en") ||
      previous === getNativePreviewSampleText("de")
        ? localizedSample
        : previous,
    );
  }, [language]);

  const setProviderPreviewText = useCallback(
    (provider: Provider, previewLanguage: TtsListenLanguage, text: string) => {
      setProviderPreviewTexts((previous) => ({
        ...previous,
        [provider]: {
          ...previous[provider],
          [previewLanguage]: text,
        },
      }));
    },
    [],
  );

  const setLocalPreviewText = useCallback(
    (previewLanguage: TtsListenLanguage, text: string) => {
      setLocalPreviewTexts((previous) => ({
        ...previous,
        [previewLanguage]: text,
      }));
    },
    [],
  );

  return {
    providerPreviewTexts,
    localPreviewTexts,
    nativePreviewText,
    setProviderPreviewText,
    setLocalPreviewText,
    setNativePreviewText,
  };
}
