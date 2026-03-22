import * as FileSystem from "expo-file-system/legacy";

import {
  PROVIDER_DEFAULT_TTS_MODELS,
  PROVIDER_DEFAULT_TTS_VOICES,
  PROVIDER_LABELS,
} from "../../constants/models";
import { translate } from "../../i18n";
import { AppLanguage, Provider } from "../../types";
import { extractProviderErrorMessage } from "../providerErrors";

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

export type ProviderTtsConfig = BinaryTtsConfig | GeminiTtsConfig;

export const TTS_PROVIDER_CONFIGS: Partial<Record<Provider, ProviderTtsConfig>> =
  {
    openai: {
      kind: "binary",
      endpoint: "https://api.openai.com/v1/audio/speech",
      defaultModel: "gpt-4o-mini-tts",
      voiceFallback: "alloy",
    },
    gemini: {
      kind: "gemini",
      endpointBase:
        "https://generativelanguage.googleapis.com/v1beta/models",
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

export function requireProviderKey(
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

function buildWavBase64FromPcm(params: {
  pcmBase64: string;
  sampleRate: number;
  language: AppLanguage;
}) {
  const pcmData = base64ToBytes(params.pcmBase64, params.language);
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  const dataLength = pcmData.length;

  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + dataLength, true);
  view.setUint32(8, 0x57415645, false);
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, params.sampleRate, true);
  view.setUint32(28, params.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, dataLength, true);

  const wavBytes = new Uint8Array(44 + dataLength);
  wavBytes.set(new Uint8Array(wavHeader), 0);
  wavBytes.set(pcmData, 44);
  return bytesToBase64(wavBytes, params.language);
}

export async function writeBase64AudioFile(
  base64: string,
  extension: "mp3" | "wav",
) {
  const path = `${FileSystem.cacheDirectory}tts-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${extension}`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType?.Base64 ?? ("base64" as never),
  });
  return path;
}

export function getGeminiAudioPart(data: any) {
  const parts = data?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return null;
  }

  return parts.find((part) => part?.inlineData?.data)?.inlineData ?? null;
}

function isInputTooLongError(errorText: string) {
  const normalized = errorText.toLowerCase();
  return (
    normalized.includes("too long") ||
    normalized.includes("at most") ||
    normalized.includes("maximum context length") ||
    normalized.includes("context_length_exceeded") ||
    normalized.includes("max tokens")
  );
}

export function buildTtsRequestError(params: {
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

export function createTtsTimeoutError(params: {
  provider: Provider;
  language: AppLanguage;
}) {
  return new Error(
    translate(params.language, "ttsTimeout", {
      provider: PROVIDER_LABELS[params.provider],
    }),
  );
}

export function getProviderTtsTimeoutMs(text: string) {
  const normalizedLength = text.trim().length;

  return Math.min(
    PROVIDER_TTS_MAX_TIMEOUT_MS,
    PROVIDER_TTS_TIMEOUT_MS +
      normalizedLength * PROVIDER_TTS_TIMEOUT_MS_PER_CHAR,
  );
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  onTimeout: () => Error,
  abortSignal?: AbortSignal,
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const handleCallerAbort = () => {
    controller.abort();
  };

  if (abortSignal) {
    if (abortSignal.aborted) {
      controller.abort();
    } else {
      abortSignal.addEventListener("abort", handleCallerAbort);
    }
  }
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
      if (abortSignal?.aborted) {
        const abortError = new Error("TTS request aborted.");
        abortError.name = "AbortError";
        throw abortError;
      }
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
    abortSignal?.removeEventListener("abort", handleCallerAbort);
  }
}

export async function writeBlobAudioFile(blob: Blob) {
  return writeBase64AudioFile(await blobToBase64(blob), "mp3");
}

export function buildWavAudioFileFromPcm(params: {
  pcmBase64: string;
  sampleRate: number;
  language: AppLanguage;
}) {
  return writeBase64AudioFile(buildWavBase64FromPcm(params), "wav");
}

export function getSelectedProviderVoice(params: {
  provider: Provider;
  requestedVoice: string;
  config: ProviderTtsConfig;
}) {
  return (
    params.requestedVoice ||
    params.config.voiceFallback ||
    PROVIDER_DEFAULT_TTS_VOICES[params.provider] ||
    ""
  );
}

export function getSelectedProviderModel(params: {
  provider: Provider;
  providerModel?: string;
  config: ProviderTtsConfig;
}) {
  return (
    params.providerModel ||
    PROVIDER_DEFAULT_TTS_MODELS[params.provider] ||
    params.config.defaultModel
  );
}
