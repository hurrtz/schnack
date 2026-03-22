import { PROVIDER_LABELS } from "../../constants/models";
import { translate } from "../../i18n";
import { AppLanguage, Provider } from "../../types";
import { getTogetherTtsLanguageCode } from "../../utils/speechLanguage";

import {
  buildTtsRequestError,
  buildWavAudioFileFromPcm,
  createTtsTimeoutError,
  fetchWithTimeout,
  getGeminiAudioPart,
  getProviderTtsTimeoutMs,
  getSelectedProviderModel,
  getSelectedProviderVoice,
  requireProviderKey,
  TTS_PROVIDER_CONFIGS,
  writeBlobAudioFile,
} from "./shared";

export async function synthesizeProviderSpeech(params: {
  text: string;
  voice: string;
  provider: Provider;
  providerModel?: string;
  apiKey?: string;
  language: AppLanguage;
  abortSignal?: AbortSignal;
}) {
  const {
    text,
    voice,
    provider,
    providerModel,
    apiKey,
    language,
    abortSignal,
  } = params;
  const config = TTS_PROVIDER_CONFIGS[provider];
  const timeoutMs = getProviderTtsTimeoutMs(text);

  if (!config) {
    throw new Error(
      translate(language, "ttsNotSupportedYet", {
        provider: PROVIDER_LABELS[provider],
      }),
    );
  }

  const selectedVoice = getSelectedProviderVoice({
    provider,
    requestedVoice: voice,
    config,
  });
  const selectedModel = getSelectedProviderModel({
    provider,
    providerModel,
    config,
  });

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
      abortSignal,
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
    return buildWavAudioFileFromPcm({
      pcmBase64,
      sampleRate,
      language,
    });
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
    abortSignal,
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

  return writeBlobAudioFile(await response.blob());
}
