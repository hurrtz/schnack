import { useCallback, useRef } from "react";

import type { SpeechDiagnosticsContext } from "../../services/speech/diagnostics";
import { createSpeechRequestId } from "../../services/speech/diagnostics";
import { getLocalTtsInstallStatus } from "../../services/localTts";
import { synthesizeSpeech } from "../../services/tts";
import {
  AppLanguage,
  Provider,
  Settings,
  TtsListenLanguage,
  VoicePreviewRequest,
} from "../../types";
import { getTtsListenLanguageLabel } from "../../constants/localTts";
import { PROVIDER_DEFAULT_TTS_MODELS } from "../../constants/models";

import { ShowToastFn, TranslateFn } from "./shared";

interface PreviewPlayer {
  enqueueAudio: (uri: string, diagnostics?: SpeechDiagnosticsContext) => void;
  isPlaying: boolean;
  resetCancellation: () => void;
  speakText: (
    text: string,
    options?: { diagnostics?: SpeechDiagnosticsContext; voice?: string },
  ) => void;
  stopPlayback: () => Promise<void>;
  waitForDrain: () => Promise<void>;
}

interface UsePreviewVoiceControllerParams {
  isBusy: boolean;
  isRecording: boolean;
  language: AppLanguage;
  player: PreviewPlayer;
  refreshLocalTtsPackStates: () => Promise<void>;
  settings: Pick<Settings, "apiKeys" | "localTtsVoices" | "providerTtsModels">;
  showToast: ShowToastFn;
  t: TranslateFn;
  ttsProvider: Provider | null;
}

export function usePreviewVoiceController({
  isBusy,
  isRecording,
  language,
  player,
  refreshLocalTtsPackStates,
  settings,
  showToast,
  t,
  ttsProvider,
}: UsePreviewVoiceControllerParams) {
  const previewSessionRef = useRef(0);
  const previewAbortRef = useRef<AbortController | null>(null);

  const handlePreviewVoice = useCallback(
    async (
      request: VoicePreviewRequest,
      callbacks?: {
        onPlaybackStarted?: () => void;
      },
    ) => {
      if (isRecording || isBusy) {
        showToast(t("stopSessionBeforePreview"));
        return;
      }

      const trimmed = request.text.trim();

      if (!trimmed) {
        return;
      }

      const previewSessionId = previewSessionRef.current + 1;
      previewSessionRef.current = previewSessionId;
      previewAbortRef.current?.abort();
      const previewAbortController = new AbortController();
      previewAbortRef.current = previewAbortController;
      const ensurePreviewActive = () => {
        if (
          previewAbortController.signal.aborted ||
          previewSessionRef.current !== previewSessionId
        ) {
          const abortError = new Error("Voice preview cancelled.");
          abortError.name = "AbortError";
          throw abortError;
        }
      };

      try {
        if (player.isPlaying) {
          await player.stopPlayback();
        }

        ensurePreviewActive();
        player.resetCancellation();
        const speechDiagnostics = {
          requestId: createSpeechRequestId("preview"),
          source: "preview" as const,
        };

        if (request.mode === "native") {
          ensurePreviewActive();
          player.speakText(trimmed, {
            voice: request.nativeVoice,
            diagnostics: speechDiagnostics,
          });
          callbacks?.onPlaybackStarted?.();
          await player.waitForDrain();
          return;
        }

        if (request.mode === "provider") {
          const providerApiKey =
            settings.apiKeys[request.provider]?.trim() ?? "";

          if (!providerApiKey) {
            showToast(t("chooseTtsToPreviewVoices"));
            return;
          }

          const audioUri = await synthesizeSpeech({
            text: trimmed,
            voice: request.voice,
            mode: "provider",
            provider: request.provider,
            providerModel:
              settings.providerTtsModels[request.provider] ||
              PROVIDER_DEFAULT_TTS_MODELS[request.provider] ||
              "",
            apiKey: providerApiKey,
            language,
            listenLanguages: [request.previewLanguage],
            diagnostics: speechDiagnostics,
            abortSignal: previewAbortController.signal,
          });

          ensurePreviewActive();
          player.enqueueAudio(audioUri, speechDiagnostics);
          callbacks?.onPlaybackStarted?.();
          await player.waitForDrain();
          return;
        }

        if (!request.voice) {
          showToast(t("chooseTtsToPreviewVoices"));
          return;
        }

        const localStatus = await getLocalTtsInstallStatus({
          language: request.localLanguage,
          voice: request.voice,
        });

        if (!localStatus.downloaded) {
          showToast(
            t("downloadSelectedLocalVoiceFirst", {
              languageLabel: getTtsListenLanguageLabel(
                request.localLanguage,
                language,
              ),
            }),
          );
          return;
        }

        const audioUri = await synthesizeSpeech({
          text: trimmed,
          voice: request.voice,
          mode: "local",
          providerModel:
            ttsProvider && settings.providerTtsModels[ttsProvider]
              ? settings.providerTtsModels[ttsProvider]
              : ttsProvider
                ? PROVIDER_DEFAULT_TTS_MODELS[ttsProvider] || ""
                : undefined,
          language,
          listenLanguages: [request.localLanguage],
          localVoices: {
            ...settings.localTtsVoices,
            [request.localLanguage]: request.voice,
          },
          diagnostics: speechDiagnostics,
          strictLocalVoice: true,
          abortSignal: previewAbortController.signal,
        });

        ensurePreviewActive();
        player.enqueueAudio(audioUri, speechDiagnostics);
        callbacks?.onPlaybackStarted?.();
        await player.waitForDrain();
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        if (request.mode === "local") {
          await refreshLocalTtsPackStates();
        }

        const message =
          error instanceof Error ? error.message : t("couldntPreviewVoice");
        showToast(message);
      } finally {
        if (previewAbortRef.current === previewAbortController) {
          previewAbortRef.current = null;
        }
      }
    },
    [
      isBusy,
      isRecording,
      language,
      player,
      refreshLocalTtsPackStates,
      settings.apiKeys,
      settings.localTtsVoices,
      settings.providerTtsModels,
      showToast,
      t,
      ttsProvider,
    ],
  );

  const stopPreviewVoice = useCallback(async () => {
    previewSessionRef.current += 1;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    await player.stopPlayback();
  }, [player]);

  return {
    handlePreviewVoice,
    stopPreviewVoice,
  };
}
