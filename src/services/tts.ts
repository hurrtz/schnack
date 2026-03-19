import * as FileSystem from "expo-file-system/legacy";
import {
  getLocalTtsVoiceOptions,
  getTtsListenLanguageLabel,
} from "../constants/localTts";
import {
  PROVIDER_DEFAULT_TTS_MODELS,
  PROVIDER_DEFAULT_TTS_VOICES,
  PROVIDER_LABELS,
} from "../constants/models";
import { translate } from "../i18n";
import { getLocalTtsInstallStatus, synthesizeLocalSpeech } from "./localTts";
import { extractProviderErrorMessage } from "./providerErrors";
import {
  createSpeechRequestId,
  recordSpeechDiagnostic,
  SpeechDiagnosticsContext,
} from "./speech/diagnostics";
import {
  AppLanguage,
  LocalTtsVoiceSelections,
  Provider,
  TtsBackendMode,
  TtsListenLanguage,
} from "../types";
import { getTogetherTtsLanguageCode } from "../utils/speechLanguage";
import {
  resolveTtsListenLanguage,
  supportsLocalTtsLanguage,
} from "../utils/ttsRouting";

let ttsCounter = 0;
export const PROVIDER_TTS_MAX_INPUT_CHARS = 3500;
export const LOCAL_TTS_MAX_INPUT_CHARS = 420;
export const PROVIDER_TTS_TIMEOUT_MS = 15000;
export const PROVIDER_TTS_TIMEOUT_MS_PER_CHAR = 10;
export const PROVIDER_TTS_MAX_TIMEOUT_MS = 60000;

export class TtsRequestError extends Error {
  readonly provider: Provider;
  readonly status: number;
  readonly inputTooLong: boolean;

  constructor(params: {
    message: string;
    provider: Provider;
    status: number;
    inputTooLong: boolean;
  }) {
    super(params.message);
    this.name = "TtsRequestError";
    this.provider = params.provider;
    this.status = params.status;
    this.inputTooLong = params.inputTooLong;
  }
}

type BinaryTtsConfig = {
  kind: "binary";
  endpoint: string;
  defaultModel: string;
  voiceFallback: string;
};

type GeminiTtsConfig = {
  kind: "gemini";
  endpointBase: string;
  defaultModel: string;
  voiceFallback: string;
};

const TTS_PROVIDER_CONFIGS: Partial<
  Record<Provider, BinaryTtsConfig | GeminiTtsConfig>
> = {
  openai: {
    kind: "binary",
    endpoint: "https://api.openai.com/v1/audio/speech",
    defaultModel: "gpt-4o-mini-tts",
    voiceFallback: "alloy",
  },
  gemini: {
    kind: "gemini",
    endpointBase: "https://generativelanguage.googleapis.com/v1beta/models",
    defaultModel: "gemini-2.5-flash-preview-tts",
    voiceFallback: "alloy",
  },
  together: {
    kind: "binary",
    endpoint: "https://api.together.xyz/v1/audio/speech",
    defaultModel: "hexgrad/Kokoro-82M",
    voiceFallback: "alloy",
  },
  xai: {
    kind: "binary",
    endpoint: "https://api.x.ai/v1/audio/speech",
    defaultModel: "grok-tts-mini",
    voiceFallback: "alloy",
  },
};

function requireProviderKey(
  provider: Provider,
  apiKey: string | undefined,
  language: AppLanguage,
) {
  if (!apiKey?.trim()) {
    throw new Error(
      translate(language, "providerConfiguredInSettings", {
        provider: PROVIDER_LABELS[provider],
      }),
    );
  }

  return apiKey.trim();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function bytesToBase64(bytes: Uint8Array, language: AppLanguage) {
  const BufferCtor = (globalThis as any).Buffer;

  if (BufferCtor) {
    return BufferCtor.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  if (typeof btoa !== "undefined") {
    return btoa(binary);
  }

  throw new Error(translate(language, "noBase64EncoderAvailable"));
}

function base64ToBytes(base64: string, language: AppLanguage) {
  const BufferCtor = (globalThis as any).Buffer;

  if (BufferCtor) {
    return new Uint8Array(BufferCtor.from(base64, "base64"));
  }

  if (typeof atob !== "undefined") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  throw new Error(translate(language, "noBase64DecoderAvailable"));
}

export function splitIntoSentences(text: string): string[] {
  const result: string[] = [];
  let current = "";

  for (const char of text) {
    current += char;

    if (char === "." || char === "!" || char === "?" || char === "\n") {
      result.push(current);
      current = "";
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}

function splitLongTtsSegment(text: string, maxChars: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  if (normalized.length <= maxChars) {
    return [normalized];
  }

  const chunks: string[] = [];
  const words = normalized.split(/\s+/);
  let current = "";

  const pushCurrent = () => {
    if (current) {
      chunks.push(current);
      current = "";
    }
  };

  for (const word of words) {
    if (!word) {
      continue;
    }

    if (!current) {
      if (word.length <= maxChars) {
        current = word;
      } else {
        for (let index = 0; index < word.length; index += maxChars) {
          chunks.push(word.slice(index, index + maxChars));
        }
      }
      continue;
    }

    const next = `${current} ${word}`;

    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    pushCurrent();

    if (word.length <= maxChars) {
      current = word;
    } else {
      for (let index = 0; index < word.length; index += maxChars) {
        chunks.push(word.slice(index, index + maxChars));
      }
    }
  }

  pushCurrent();
  return chunks;
}

export function splitTextForTts(
  text: string,
  maxChars = PROVIDER_TTS_MAX_INPUT_CHARS,
): string[] {
  const normalized = text.trim();

  if (!normalized) {
    return [];
  }

  const sentenceSegments = splitIntoSentences(normalized);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current) {
      chunks.push(current);
      current = "";
    }
  };

  const appendSegment = (segment: string) => {
    const normalizedSegment = segment.replace(/\s+/g, " ").trim();

    if (!normalizedSegment) {
      return;
    }

    if (normalizedSegment.length > maxChars) {
      pushCurrent();
      chunks.push(...splitLongTtsSegment(normalizedSegment, maxChars));
      return;
    }

    if (!current) {
      current = normalizedSegment;
      return;
    }

    const next = `${current} ${normalizedSegment}`;

    if (next.length <= maxChars) {
      current = next;
      return;
    }

    pushCurrent();
    current = normalizedSegment;
  };

  sentenceSegments.forEach(appendSegment);
  pushCurrent();
  return chunks;
}

function buildWavBase64FromPcm(params: {
  pcmBase64: string;
  sampleRate: number;
  channels?: number;
  bitsPerSample?: number;
  language: AppLanguage;
}) {
  const channels = params.channels ?? 1;
  const bitsPerSample = params.bitsPerSample ?? 16;
  const pcmBytes = base64ToBytes(params.pcmBase64, params.language);
  const byteRate = (params.sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, params.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, "data");
  view.setUint32(40, pcmBytes.length, true);

  const wavBytes = new Uint8Array(44 + pcmBytes.length);
  wavBytes.set(new Uint8Array(header), 0);
  wavBytes.set(pcmBytes, 44);
  return bytesToBase64(wavBytes, params.language);
}

async function writeBase64AudioFile(base64: string, extension: "mp3" | "wav") {
  const path = `${FileSystem.cacheDirectory}tts-${Date.now()}-${ttsCounter++}.${extension}`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: "base64" });
  return path;
}

function getGeminiAudioPart(data: any) {
  const parts = data?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return null;
  }

  return (
    parts.find((part) => typeof part?.inlineData?.data === "string")
      ?.inlineData ?? null
  );
}

function isInputTooLongError(errorText: string) {
  const normalized = errorText.toLowerCase();

  return (
    normalized.includes("string_too_long") ||
    normalized.includes("max_length") ||
    normalized.includes("input string should have at most") ||
    normalized.includes("too long") ||
    normalized.includes("too many characters")
  );
}

function buildTtsRequestError(params: {
  provider: Provider;
  status: number;
  errorText: string;
  language: AppLanguage;
}) {
  const normalizedMessage = extractProviderErrorMessage(params.errorText);
  const inputTooLong = isInputTooLongError(
    `${normalizedMessage} ${params.errorText}`,
  );

  return new TtsRequestError({
    provider: params.provider,
    status: params.status,
    inputTooLong,
    message: inputTooLong
      ? translate(params.language, "ttsReplyTooLong", {
          provider: PROVIDER_LABELS[params.provider],
        })
      : translate(params.language, "ttsError", {
          provider: PROVIDER_LABELS[params.provider],
          status: params.status,
          errorText: normalizedMessage,
        }),
  });
}

function createTtsTimeoutError(params: {
  provider: Provider;
  language: AppLanguage;
}) {
  return new Error(
    translate(params.language, "ttsTimeout", {
      provider: PROVIDER_LABELS[params.provider],
    }),
  );
}

function getResolvedLocalTtsSelection(params: {
  text: string;
  language: AppLanguage;
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

async function trySynthesizeResolvedLocalSpeech(params: {
  text: string;
  language: AppLanguage;
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

export function getProviderTtsTimeoutMs(text: string) {
  const normalizedLength = text.trim().length;

  return Math.min(
    PROVIDER_TTS_MAX_TIMEOUT_MS,
    PROVIDER_TTS_TIMEOUT_MS +
      normalizedLength * PROVIDER_TTS_TIMEOUT_MS_PER_CHAR,
  );
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  onTimeout: () => Error,
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(onTimeout());
    }, timeoutMs);
  });

  const fetchPromise = fetch(input, {
    ...init,
    signal: controller.signal,
  }).catch((error) => {
    if (
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.message.toLowerCase().includes("aborted"))
    ) {
      throw onTimeout();
    }

    throw error;
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function synthesizeSpeech(params: {
  text: string;
  voice: string;
  mode: TtsBackendMode;
  provider?: Provider | null;
  providerModel?: string;
  apiKey?: string;
  language: AppLanguage;
  listenLanguages?: TtsListenLanguage[];
  localVoices?: LocalTtsVoiceSelections;
  diagnostics?: SpeechDiagnosticsContext;
  strictLocalVoice?: boolean;
}): Promise<string> {
  const {
    text,
    voice,
    mode,
    provider,
    providerModel,
    apiKey,
    language,
    listenLanguages,
    localVoices,
    diagnostics,
    strictLocalVoice,
  } = params;
  const requestId = diagnostics?.requestId ?? createSpeechRequestId("tts");

  recordSpeechDiagnostic({
    requestId,
    source: diagnostics?.source ?? "unknown",
    stage: "tts-requested",
    requestedRoute: mode,
    mode,
    provider: provider ?? null,
    voice: voice || null,
    language: listenLanguages?.[0] ?? "app",
    textLength: text.trim().length,
  });

  if (mode === "native") {
    throw new Error(
      translate(language, "nativeTtsDoesNotSynthesizeAudioFiles"),
    );
  }

  if (mode === "local") {
    const localSelection = getResolvedLocalTtsSelection({
      text,
      language,
      listenLanguages,
      localVoices,
    });

    try {
      const localResult = await trySynthesizeResolvedLocalSpeech({
        text,
        language,
        listenLanguages,
        localVoices,
        diagnostics: {
          requestId,
          source: diagnostics?.source,
        },
        strictLocalVoice,
      });

      if (localResult) {
        recordSpeechDiagnostic({
          requestId,
          source: diagnostics?.source ?? "unknown",
          stage: "tts-succeeded",
          requestedRoute: "local",
          actualRoute: "local",
          language: localResult.resolvedLanguage,
          voice: localResult.voice,
          textLength: text.trim().length,
        });
        return localResult.audioPath;
      }
    } catch (error) {
      if (!provider || !apiKey?.trim()) {
        recordSpeechDiagnostic({
          requestId,
          source: diagnostics?.source ?? "unknown",
          stage: "tts-failed",
          requestedRoute: "local",
          actualRoute: "local",
          provider: provider ?? null,
          voice: voice || null,
          textLength: text.trim().length,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      recordSpeechDiagnostic({
        requestId,
        source: diagnostics?.source ?? "unknown",
        stage: "tts-fallback",
        requestedRoute: "local",
        actualRoute: "provider",
        provider,
        voice: voice || null,
        textLength: text.trim().length,
        fallbackReason:
          error instanceof Error ? error.message : "Local synthesis failed.",
      });
    }

    if (provider && apiKey?.trim()) {
      const audioPath = await synthesizeProviderSpeech({
        text,
        voice,
        provider,
        providerModel,
        apiKey,
        language,
      });
      recordSpeechDiagnostic({
        requestId,
        source: diagnostics?.source ?? "unknown",
        stage: "tts-succeeded",
        requestedRoute: "local",
        actualRoute: "provider",
        provider,
        voice: voice || null,
        textLength: text.trim().length,
      });
      return audioPath;
    }

    recordSpeechDiagnostic({
      requestId,
      source: diagnostics?.source ?? "unknown",
      stage: "tts-failed",
      requestedRoute: "local",
      actualRoute: "local",
      voice: voice || null,
      textLength: text.trim().length,
      fallbackReason: "No provider fallback configured.",
    });

    throw new Error(
      translate(language, "localTtsUnavailableForLanguage", {
        languageLabel: getTtsListenLanguageLabel(
          localSelection.resolvedLanguage,
          language,
        ),
      }),
    );
  }

  if (!provider) {
    try {
      const localResult = await trySynthesizeResolvedLocalSpeech({
        text,
        language,
        listenLanguages,
        localVoices,
        diagnostics: {
          requestId,
          source: diagnostics?.source,
        },
        strictLocalVoice,
      });

      if (localResult) {
        recordSpeechDiagnostic({
          requestId,
          source: diagnostics?.source ?? "unknown",
          stage: "tts-succeeded",
          requestedRoute: "provider",
          actualRoute: "local",
          language: localResult.resolvedLanguage,
          textLength: text.trim().length,
          fallbackReason: "No provider configured.",
        });
        return localResult.audioPath;
      }
    } catch {
      // Provider mode still falls through to the native fallback upstream if local is unavailable.
    }

    throw new Error(
      translate(language, "chooseTextToSpeechProviderInSettings"),
    );
  }

  try {
    const audioPath = await synthesizeProviderSpeech({
      text,
      voice,
      provider,
      providerModel,
      apiKey,
      language,
    });
    recordSpeechDiagnostic({
      requestId,
      source: diagnostics?.source ?? "unknown",
      stage: "tts-succeeded",
      requestedRoute: "provider",
      actualRoute: "provider",
      provider,
      voice: voice || null,
      textLength: text.trim().length,
    });
    return audioPath;
  } catch (providerError) {
    try {
      const localResult = await trySynthesizeResolvedLocalSpeech({
        text,
        language,
        listenLanguages,
        localVoices,
        diagnostics: {
          requestId,
          source: diagnostics?.source,
        },
        strictLocalVoice,
      });

      if (localResult) {
        recordSpeechDiagnostic({
          requestId,
          source: diagnostics?.source ?? "unknown",
          stage: "tts-fallback",
          requestedRoute: "provider",
          actualRoute: "local",
          language: localResult.resolvedLanguage,
          provider,
          voice: voice || null,
          textLength: text.trim().length,
          fallbackReason:
            providerError instanceof Error
              ? providerError.message
              : "Provider synthesis failed.",
        });
        return localResult.audioPath;
      }
    } catch {
      // Provider remains the primary mode here; fall through to native fallback upstream.
    }

    recordSpeechDiagnostic({
      requestId,
      source: diagnostics?.source ?? "unknown",
      stage: "tts-failed",
      requestedRoute: "provider",
      actualRoute: "provider",
      provider,
      voice: voice || null,
      textLength: text.trim().length,
      message:
        providerError instanceof Error
          ? providerError.message
          : String(providerError),
    });

    throw providerError;
  }
}

export async function synthesizeSpeechSequence(params: {
  text: string;
  voice: string;
  mode: TtsBackendMode;
  provider?: Provider | null;
  providerModel?: string;
  apiKey?: string;
  language: AppLanguage;
  listenLanguages?: TtsListenLanguage[];
  localVoices?: LocalTtsVoiceSelections;
  diagnostics?: SpeechDiagnosticsContext;
}) {
  if (params.mode !== "provider") {
    const maxChars =
      params.mode === "local"
        ? LOCAL_TTS_MAX_INPUT_CHARS
        : PROVIDER_TTS_MAX_INPUT_CHARS;
    const segments = splitTextForTts(params.text, maxChars);

    if (segments.length === 0) {
      return [];
    }

    const audioFiles: string[] = [];

    for (const segment of segments) {
      audioFiles.push(
        await synthesizeSpeech({
          ...params,
          text: segment,
        }),
      );
    }

    return audioFiles;
  }

  const segments = splitTextForTts(params.text, PROVIDER_TTS_MAX_INPUT_CHARS);

  if (segments.length === 0) {
    return [];
  }

  const audioFiles: string[] = [];

  for (const segment of segments) {
    const audioFile = await synthesizeSpeech({
      ...params,
      text: segment,
    });
    audioFiles.push(audioFile);
  }

  return audioFiles;
}

async function synthesizeProviderSpeech(params: {
  text: string;
  voice: string;
  provider: Provider;
  providerModel?: string;
  apiKey?: string;
  language: AppLanguage;
}) {
  const { text, voice, provider, providerModel, apiKey, language } = params;
  const config = TTS_PROVIDER_CONFIGS[provider];
  const timeoutMs = getProviderTtsTimeoutMs(text);

  if (!config) {
    throw new Error(
      translate(language, "ttsNotSupportedYet", {
        provider: PROVIDER_LABELS[provider],
      }),
    );
  }

  const selectedVoice =
    voice ||
    config.voiceFallback ||
    PROVIDER_DEFAULT_TTS_VOICES[provider] ||
    "";
  const selectedModel =
    providerModel ||
    PROVIDER_DEFAULT_TTS_MODELS[provider] ||
    config.defaultModel;

  if (config.kind === "gemini") {
    const response = await fetchWithTimeout(
      `${config.endpointBase}/${selectedModel}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": requireProviderKey(provider, apiKey, language),
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Read the following text aloud exactly as written without adding or removing words:\n\n${text}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: selectedVoice,
                },
              },
            },
          },
        }),
      },
      timeoutMs,
      () => createTtsTimeoutError({ provider, language }),
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw buildTtsRequestError({
        provider,
        status: response.status,
        errorText,
        language,
      });
    }

    const data = await response.json();
    const audioPart = getGeminiAudioPart(data);
    const pcmBase64 = audioPart?.data;

    if (!pcmBase64) {
      throw new Error(
        translate(language, "ttsDidNotReturnAudio", {
          provider: PROVIDER_LABELS[provider],
        }),
      );
    }

    const mimeType = audioPart?.mimeType as string | undefined;
    const sampleRate = Number(mimeType?.match(/rate=(\d+)/i)?.[1]) || 24000;
    const wavBase64 = buildWavBase64FromPcm({
      pcmBase64,
      sampleRate,
      language,
    });
    return writeBase64AudioFile(wavBase64, "wav");
  }

  const requestBody =
    provider === "together"
      ? {
          model: selectedModel,
          voice: selectedVoice,
          input: text,
          response_format: "mp3",
          language: getTogetherTtsLanguageCode(text),
        }
      : provider === "xai"
        ? {
            model: selectedModel,
            text,
            voice_id: selectedVoice,
            language: "auto",
            output_format: {
              codec: "mp3",
              sample_rate: 24000,
              bit_rate: 128000,
            },
          }
        : {
            model: selectedModel,
            voice: selectedVoice,
            input: text,
            response_format: "mp3",
          };

  const response = await fetchWithTimeout(
    config.endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${requireProviderKey(provider, apiKey, language)}`,
      },
      body: JSON.stringify(requestBody),
    },
    timeoutMs,
    () => createTtsTimeoutError({ provider, language }),
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw buildTtsRequestError({
      provider,
      status: response.status,
      errorText,
      language,
    });
  }

  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  return writeBase64AudioFile(base64, "mp3");
}
