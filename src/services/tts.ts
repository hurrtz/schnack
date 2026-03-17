import * as FileSystem from "expo-file-system/legacy";
import { getTtsListenLanguageLabel } from "../constants/localTts";
import { PROVIDER_DEFAULT_TTS_VOICES, PROVIDER_LABELS } from "../constants/models";
import { translate } from "../i18n";
import { synthesizeLocalSpeech } from "./localTts";
import {
  AppLanguage,
  LocalTtsVoiceSelections,
  Provider,
  TtsBackendMode,
  TtsListenLanguage,
} from "../types";
import { getTogetherTtsLanguageCode } from "../utils/speechLanguage";
import { resolveTtsListenLanguage, supportsLocalTtsLanguage } from "../utils/ttsRouting";

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
  model: string;
  voiceFallback: string;
};

type GeminiTtsConfig = {
  kind: "gemini";
  endpoint: string;
  model: string;
  voiceFallback: string;
};

const TTS_PROVIDER_CONFIGS: Partial<Record<Provider, BinaryTtsConfig | GeminiTtsConfig>> = {
  openai: {
    kind: "binary",
    endpoint: "https://api.openai.com/v1/audio/speech",
    model: "tts-1",
    voiceFallback: "alloy",
  },
  gemini: {
    kind: "gemini",
    endpoint:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
    model: "gemini-2.5-flash-preview-tts",
    voiceFallback: "alloy",
  },
  together: {
    kind: "binary",
    endpoint: "https://api.together.xyz/v1/audio/speech",
    model: "hexgrad/Kokoro-82M",
    voiceFallback: "alloy",
  },
  xai: {
    kind: "binary",
    endpoint: "https://api.x.ai/v1/audio/speech",
    model: "grok-tts-mini",
    voiceFallback: "alloy",
  },
};

function requireProviderKey(
  provider: Provider,
  apiKey: string | undefined,
  language: AppLanguage
) {
  if (!apiKey?.trim()) {
    throw new Error(
      translate(language, "providerConfiguredInSettings", {
        provider: PROVIDER_LABELS[provider],
      })
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

function splitIntoSentences(text: string): string[] {
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
  maxChars = PROVIDER_TTS_MAX_INPUT_CHARS
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
    parts.find((part) => typeof part?.inlineData?.data === "string")?.inlineData ?? null
  );
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractProviderErrorMessage(errorText: string) {
  const parsed = safeJsonParse(errorText);

  if (!parsed) {
    return errorText.replace(/\s+/g, " ").trim();
  }

  if (typeof parsed === "string") {
    return parsed.trim();
  }

  if (typeof parsed?.error?.message === "string") {
    return parsed.error.message.trim();
  }

  if (typeof parsed?.message === "string") {
    return parsed.message.trim();
  }

  if (Array.isArray(parsed?.errors)) {
    const firstMessage = parsed.errors.find(
      (entry: any) => typeof entry?.message === "string"
    )?.message;

    if (typeof firstMessage === "string") {
      return firstMessage.trim();
    }
  }

  return errorText.replace(/\s+/g, " ").trim();
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
    `${normalizedMessage} ${params.errorText}`
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
    })
  );
}

export function getProviderTtsTimeoutMs(text: string) {
  const normalizedLength = text.trim().length;

  return Math.min(
    PROVIDER_TTS_MAX_TIMEOUT_MS,
    PROVIDER_TTS_TIMEOUT_MS + normalizedLength * PROVIDER_TTS_TIMEOUT_MS_PER_CHAR
  );
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  onTimeout: () => Error
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
      (error.name === "AbortError" || error.message.toLowerCase().includes("aborted"))
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
  apiKey?: string;
  language: AppLanguage;
  listenLanguages?: TtsListenLanguage[];
  localVoices?: LocalTtsVoiceSelections;
}): Promise<string> {
  const {
    text,
    voice,
    mode,
    provider,
    apiKey,
    language,
    listenLanguages,
    localVoices,
  } = params;

  if (mode === "native") {
    throw new Error(translate(language, "nativeTtsDoesNotSynthesizeAudioFiles"));
  }

  if (mode === "local") {
    const resolvedLanguage = resolveTtsListenLanguage({
      text,
      preferredLanguages: listenLanguages,
      appLanguage: language,
    });
    const localVoice = localVoices?.[resolvedLanguage] || "";

    if (supportsLocalTtsLanguage(resolvedLanguage) && localVoice) {
      try {
        return await synthesizeLocalSpeech({
          text,
          language: resolvedLanguage,
          voice: localVoice,
        });
      } catch (error) {
        if (!provider || !apiKey?.trim()) {
          throw error;
        }
      }
    }

    if (provider && apiKey?.trim()) {
      return synthesizeProviderSpeech({
        text,
        voice,
        provider,
        apiKey,
        language,
      });
    }

    throw new Error(
      translate(language, "localTtsUnavailableForLanguage", {
        languageLabel: getTtsListenLanguageLabel(resolvedLanguage, language),
      })
    );
  }

  if (!provider) {
    throw new Error(translate(language, "chooseTextToSpeechProviderInSettings"));
  }

  return synthesizeProviderSpeech({
    text,
    voice,
    provider,
    apiKey,
    language,
  });
}

export async function synthesizeSpeechSequence(params: {
  text: string;
  voice: string;
  mode: TtsBackendMode;
  provider?: Provider | null;
  apiKey?: string;
  language: AppLanguage;
  listenLanguages?: TtsListenLanguage[];
  localVoices?: LocalTtsVoiceSelections;
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
        })
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
  apiKey?: string;
  language: AppLanguage;
}) {
  const { text, voice, provider, apiKey, language } = params;
  const config = TTS_PROVIDER_CONFIGS[provider];
  const timeoutMs = getProviderTtsTimeoutMs(text);

  if (!config) {
    throw new Error(
      translate(language, "ttsNotSupportedYet", {
        provider: PROVIDER_LABELS[provider],
      })
    );
  }

  const selectedVoice =
    voice || config.voiceFallback || PROVIDER_DEFAULT_TTS_VOICES[provider] || "";

  if (config.kind === "gemini") {
    const response = await fetchWithTimeout(
      config.endpoint,
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
      () => createTtsTimeoutError({ provider, language })
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
        })
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
          model: config.model,
          voice: selectedVoice,
          input: text,
          response_format: "mp3",
          language: getTogetherTtsLanguageCode(text),
        }
      : provider === "xai"
        ? {
            model: config.model,
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
            model: config.model,
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
    () => createTtsTimeoutError({ provider, language })
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
