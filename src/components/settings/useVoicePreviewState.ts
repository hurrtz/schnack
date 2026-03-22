import { useCallback, useEffect, useState } from "react";

import { getLocalTtsVoiceOptions } from "../../constants/localTts";
import {
  PROVIDER_DEFAULT_TTS_VOICES,
  getProviderTtsVoiceOptions,
} from "../../constants/models";
import { AppLanguage, Provider, Settings, TtsListenLanguage } from "../../types";

import {
  LocalPreviewTexts,
  PreviewButtonPhase,
  ProviderPreviewTexts,
  SettingsModalProps,
} from "./types";

export function useVoicePreviewState(params: {
  visible: boolean;
  settings: Settings;
  language: AppLanguage;
  providerPreviewTexts: ProviderPreviewTexts;
  localPreviewTexts: LocalPreviewTexts;
  nativePreviewText: string;
  selectedNativeVoice: string;
  onPreviewVoice: SettingsModalProps["onPreviewVoice"];
  onStopPreviewVoice: SettingsModalProps["onStopPreviewVoice"];
}) {
  const {
    visible,
    settings,
    language,
    providerPreviewTexts,
    localPreviewTexts,
    nativePreviewText,
    selectedNativeVoice,
    onPreviewVoice,
    onStopPreviewVoice,
  } = params;
  const [activePreview, setActivePreview] = useState<{
    id: string;
    phase: PreviewButtonPhase;
  } | null>(null);

  useEffect(() => {
    if (!visible) {
      setActivePreview(null);
    }
  }, [visible]);

  const handleExactPreview = useCallback(
    async (
      previewId: string,
      request: Parameters<SettingsModalProps["onPreviewVoice"]>[0],
    ) => {
      const trimmed = request.text.trim();

      if (!trimmed) {
        return;
      }

      if (activePreview?.id === previewId) {
        setActivePreview(null);
        await onStopPreviewVoice();
        return;
      }

      if (activePreview) {
        return;
      }

      setActivePreview({ id: previewId, phase: "generating" });
      try {
        await onPreviewVoice(
          {
            ...request,
            text: trimmed,
          },
          {
            onPlaybackStarted: () => {
              setActivePreview((current) =>
                current?.id === previewId
                  ? { id: previewId, phase: "playing" }
                  : current,
              );
            },
          },
        );
      } finally {
        setActivePreview((current) =>
          current?.id === previewId ? null : current,
        );
      }
    },
    [activePreview, onPreviewVoice, onStopPreviewVoice],
  );

  const handlePreviewLocalVoice = useCallback(
    async (selectedLanguage: TtsListenLanguage) => {
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
    },
    [handleExactPreview, localPreviewTexts, settings.localTtsVoices],
  );

  const handlePreviewProviderVoice = useCallback(
    async (provider: Provider, previewLanguage: TtsListenLanguage) => {
      const selectedVoice =
        settings.providerTtsVoices[provider] ||
        PROVIDER_DEFAULT_TTS_VOICES[provider] ||
        getProviderTtsVoiceOptions(provider, language)[0]?.id ||
        "";

      await handleExactPreview(`provider:${provider}:${previewLanguage}`, {
        text: providerPreviewTexts[provider][previewLanguage],
        mode: "provider",
        provider,
        voice: selectedVoice,
        previewLanguage,
      });
    },
    [
      handleExactPreview,
      language,
      providerPreviewTexts,
      settings.providerTtsVoices,
    ],
  );

  const handlePreviewNativeVoice = useCallback(async () => {
    await handleExactPreview("native", {
      text: nativePreviewText,
      mode: "native",
      nativeVoice: selectedNativeVoice || undefined,
    });
  }, [handleExactPreview, nativePreviewText, selectedNativeVoice]);

  return {
    activePreview,
    handlePreviewLocalVoice,
    handlePreviewProviderVoice,
    handlePreviewNativeVoice,
  };
}
