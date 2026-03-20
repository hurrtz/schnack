import * as FileSystem from "expo-file-system/legacy";
import { PROVIDER_LABELS } from "../constants/models";
import { translate } from "../i18n";
import {
  buildProviderHttpError,
  normalizeProviderTransportError,
} from "./providerErrors";
import { AppLanguage, Provider, SttBackendMode } from "../types";
import {
  getDeviceLocale,
  getFileAudioMimeType,
  getMistralSttLanguageCode,
} from "../utils/speechLanguage";

type MultipartTranscriptionConfig = {
  kind: "multipart";
  endpoint: string;
  defaultModel: string;
  languageHint?: () => string | undefined;
};

type GeminiTranscriptionConfig = {
  kind: "gemini";
  endpointBase: string;
  defaultModel: string;
};

const STT_TIMEOUT_MS = 30000;

const STT_PROVIDER_CONFIGS: Partial<
  Record<Provider, MultipartTranscriptionConfig | GeminiTranscriptionConfig>
> = {
  openai: {
    kind: "multipart",
    endpoint: "https://api.openai.com/v1/audio/transcriptions",
    defaultModel: "gpt-4o-mini-transcribe",
  },
  groq: {
    kind: "multipart",
    endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
    defaultModel: "whisper-large-v3-turbo",
  },
  gemini: {
    kind: "gemini",
    endpointBase: "https://generativelanguage.googleapis.com/v1beta/models",
    defaultModel: "gemini-2.5-flash",
  },
  mistral: {
    kind: "multipart",
    endpoint: "https://api.mistral.ai/v1/audio/transcriptions",
    defaultModel: "voxtral-mini-latest",
    languageHint: getMistralSttLanguageCode,
  },
  together: {
    kind: "multipart",
    endpoint: "https://api.together.xyz/v1/audio/transcriptions",
    defaultModel: "openai/whisper-large-v3",
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

function extractTextFromGeminiResponse(data: any) {
  const parts = data?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function createSttTimeoutError(params: {
  provider: Provider;
  language: AppLanguage;
}) {
  return new Error(
    translate(params.language, "sttTimeout", {
      provider: PROVIDER_LABELS[params.provider],
    })
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

export async function transcribeAudio(params: {
  fileUri: string;
  mode: SttBackendMode;
  provider?: Provider | null;
  providerModel?: string;
  apiKey?: string;
  language: AppLanguage;
}): Promise<string | null> {
  const { fileUri, mode, provider, providerModel, apiKey, language } = params;

  if (mode === "native") {
    throw new Error(translate(language, "nativeSttHandledInApp"));
  }

  if (!provider) {
    throw new Error(translate(language, "chooseSpeechToTextProviderInSettings"));
  }

  const config = STT_PROVIDER_CONFIGS[provider];

  if (!config) {
    throw new Error(
      translate(language, "sttNotSupportedYet", {
        provider: PROVIDER_LABELS[provider],
      })
    );
  }

  if (config.kind === "gemini") {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: "base64",
    });

    let response: Awaited<ReturnType<typeof fetch>>;

    try {
      response = await fetchWithTimeout(
        `${config.endpointBase}/${providerModel || config.defaultModel}:generateContent`,
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
                    text: `Transcribe this audio exactly. Return only the transcription text in the original spoken language. Do not translate, summarize, or add commentary. Current locale hint: ${getDeviceLocale()}.`,
                  },
                  {
                    inlineData: {
                      mimeType: getFileAudioMimeType(fileUri),
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
            },
          }),
        },
        STT_TIMEOUT_MS,
        () => createSttTimeoutError({ provider, language })
      );
    } catch (error) {
      throw normalizeProviderTransportError({
        provider,
        language,
        error,
        action: "transcription",
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw buildProviderHttpError({
        provider,
        language,
        status: response.status,
        errorText,
        action: "transcription",
      });
    }

    const data = await response.json();
    const text = extractTextFromGeminiResponse(data);
    return text ? text : null;
  }

  const formData = new FormData();
  formData.append(
    "file",
    {
      uri: fileUri,
      type: getFileAudioMimeType(fileUri),
      name: fileUri.split("/").pop() || "recording.m4a",
    } as any
  );
  formData.append("model", providerModel || config.defaultModel);
  const languageHint = config.languageHint?.();
  if (languageHint) {
    formData.append("language", languageHint);
  }

  let response: Awaited<ReturnType<typeof fetch>>;

  try {
    response = await fetchWithTimeout(
      config.endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${requireProviderKey(provider, apiKey, language)}`,
        },
        body: formData,
      },
      STT_TIMEOUT_MS,
      () => createSttTimeoutError({ provider, language })
    );
  } catch (error) {
    throw normalizeProviderTransportError({
      provider,
      language,
      error,
      action: "transcription",
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw buildProviderHttpError({
      provider,
      language,
      status: response.status,
      errorText,
      action: "transcription",
    });
  }

  const data = await response.json();
  const text = data.text?.trim();
  return text ? text : null;
}
