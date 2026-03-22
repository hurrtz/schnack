import { getLocalTtsVoiceOptions } from "../../constants/localTts";
import { LocalTtsVoiceSelections, TtsListenLanguage } from "../../types";
import { resolveTtsListenLanguage, supportsLocalTtsLanguage } from "../../utils/ttsRouting";
import { getLocalTtsInstallStatus, synthesizeLocalSpeech } from "../localTts";
import {
  recordSpeechDiagnostic,
  SpeechDiagnosticsContext,
} from "../speech/diagnostics";

export function getResolvedLocalTtsSelection(params: {
  text: string;
  language: "en" | "de";
  listenLanguages?: TtsListenLanguage[];
  localVoices?: LocalTtsVoiceSelections;
}) {
  const resolvedLanguage = resolveTtsListenLanguage({
    text: params.text,
    preferredLanguages: params.listenLanguages,
    appLanguage: params.language,
  });
  const localVoice = params.localVoices?.[resolvedLanguage] || "";

  return {
    resolvedLanguage,
    localVoice,
    canUseLocal: supportsLocalTtsLanguage(resolvedLanguage) && !!localVoice,
  };
}

export async function trySynthesizeResolvedLocalSpeech(params: {
  text: string;
  language: "en" | "de";
  listenLanguages?: TtsListenLanguage[];
  localVoices?: LocalTtsVoiceSelections;
  diagnostics?: SpeechDiagnosticsContext;
  strictLocalVoice?: boolean;
}) {
  const selection = getResolvedLocalTtsSelection(params);

  if (!supportsLocalTtsLanguage(selection.resolvedLanguage)) {
    return null;
  }

  const candidateVoices = params.strictLocalVoice
    ? [selection.localVoice].filter((voice): voice is string => !!voice)
    : [
        selection.localVoice,
        ...getLocalTtsVoiceOptions(selection.resolvedLanguage).map(
          (option) => option.value,
        ),
      ].filter((voice, index, values): voice is string => {
        return !!voice && values.indexOf(voice) === index;
      });

  let lastError: unknown = null;

  for (const voice of candidateVoices) {
    const status = await getLocalTtsInstallStatus({
      language: selection.resolvedLanguage,
      voice,
    });

    if (!status.installed) {
      continue;
    }

    try {
      recordSpeechDiagnostic({
        requestId: params.diagnostics?.requestId,
        source: params.diagnostics?.source ?? "unknown",
        stage: "local-attempt",
        requestedRoute: "local",
        actualRoute: "local",
        language: selection.resolvedLanguage,
        voice,
        textLength: params.text.trim().length,
      });

      return {
        resolvedLanguage: selection.resolvedLanguage,
        voice,
        audioPath: await synthesizeLocalSpeech({
          text: params.text,
          language: selection.resolvedLanguage,
          voice,
        }),
      };
    } catch (error) {
      lastError = error;
      recordSpeechDiagnostic({
        requestId: params.diagnostics?.requestId,
        source: params.diagnostics?.source ?? "unknown",
        stage: "local-failed",
        requestedRoute: "local",
        actualRoute: "local",
        language: selection.resolvedLanguage,
        voice,
        textLength: params.text.trim().length,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}
