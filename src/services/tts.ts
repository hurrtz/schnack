import * as FileSystem from "expo-file-system/legacy";
import { PROVIDER_LABELS } from "../constants/models";
import { Provider, VoiceBackendMode } from "../types";

let ttsCounter = 0;

const TTS_PROVIDER_CONFIGS: Partial<
  Record<Provider, { endpoint: string; model: string; voiceFallback: string }>
> = {
  openai: {
    endpoint: "https://api.openai.com/v1/audio/speech",
    model: "tts-1",
    voiceFallback: "alloy",
  },
};

function requireProviderKey(provider: Provider, apiKey?: string) {
  if (!apiKey?.trim()) {
    throw new Error(`${PROVIDER_LABELS[provider]} is not configured in Settings.`);
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

export async function synthesizeSpeech(params: {
  text: string;
  voice: string;
  mode: VoiceBackendMode;
  provider?: Provider | null;
  apiKey?: string;
}): Promise<string> {
  const { text, voice, mode, provider, apiKey } = params;

  if (mode === "native") {
    throw new Error("Native TTS does not synthesize audio files.");
  }

  if (!provider) {
    throw new Error("Choose a text-to-speech provider in Settings.");
  }

  const config = TTS_PROVIDER_CONFIGS[provider];

  if (!config) {
    throw new Error(`${PROVIDER_LABELS[provider]} TTS is not supported yet.`);
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireProviderKey(provider, apiKey)}`,
    },
    body: JSON.stringify({
      model: config.model,
      voice: voice || config.voiceFallback,
      input: text,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `${PROVIDER_LABELS[provider]} TTS error (${response.status}): ${errorText}`
    );
  }

  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  const path = `${FileSystem.cacheDirectory}tts-${Date.now()}-${ttsCounter++}.mp3`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: "base64" });
  return path;
}
