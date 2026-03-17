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
  model: string;
  languageHint?: () => string | undefined;
};

type GeminiTranscriptionConfig = {
  kind: "gemini";
  endpoint: string;
  model: string;
};

const STT_PROVIDER_CONFIGS: Partial<
  Record<Provider, MultipartTranscriptionConfig | GeminiTranscriptionConfig>
> = {
  openai: {
    kind: "multipart",
    endpoint: "https://api.openai.com/v1/audio/transcriptions",
    model: "whisper-1",
  },
  groq: {
    kind: "multipart",
    endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
    model: "whisper-large-v3-turbo",
  },
  gemini: {
    kind: "gemini",
    endpoint:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    model: "gemini-2.5-flash",
  },
  mistral: {
    kind: "multipart",
    endpoint: "https://api.mistral.ai/v1/audio/transcriptions",
    model: "voxtral-mini-latest",
    languageHint: getMistralSttLanguageCode,
  },
  together: {
    kind: "multipart",
    endpoint: "https://api.together.xyz/v1/audio/transcriptions",
    model: "openai/whisper-large-v3",
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

export async function transcribeAudio(params: {
  fileUri: string;
  mode: SttBackendMode;
  provider?: Provider | null;
  apiKey?: string;
  language: AppLanguage;
}): Promise<string | null> {
  const { fileUri, mode, provider, apiKey, language } = params;

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
      response = await fetch(config.endpoint, {
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
      });
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
  formData.append("model", config.model);
  const languageHint = config.languageHint?.();
  if (languageHint) {
    formData.append("language", languageHint);
  }

  let response: Awaited<ReturnType<typeof fetch>>;

  try {
    response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireProviderKey(provider, apiKey, language)}`,
      },
      body: formData,
    });
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
