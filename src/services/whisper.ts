import { PROVIDER_LABELS } from "../constants/models";
import { Provider, VoiceBackendMode } from "../types";

const STT_PROVIDER_CONFIGS: Partial<
  Record<Provider, { endpoint: string; model: string }>
> = {
  openai: {
    endpoint: "https://api.openai.com/v1/audio/transcriptions",
    model: "whisper-1",
  },
  groq: {
    endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
    model: "whisper-large-v3-turbo",
  },
  together: {
    endpoint: "https://api.together.xyz/v1/audio/transcriptions",
    model: "openai/whisper-large-v3",
  },
};

function requireProviderKey(provider: Provider, apiKey?: string) {
  if (!apiKey?.trim()) {
    throw new Error(`${PROVIDER_LABELS[provider]} is not configured in Settings.`);
  }

  return apiKey.trim();
}

export async function transcribeAudio(params: {
  fileUri: string;
  mode: VoiceBackendMode;
  provider?: Provider | null;
  apiKey?: string;
}): Promise<string | null> {
  const { fileUri, mode, provider, apiKey } = params;

  if (mode === "native") {
    throw new Error("Native STT is handled directly in the app.");
  }

  if (!provider) {
    throw new Error("Choose a speech-to-text provider in Settings.");
  }

  const config = STT_PROVIDER_CONFIGS[provider];

  if (!config) {
    throw new Error(`${PROVIDER_LABELS[provider]} STT is not supported yet.`);
  }

  const formData = new FormData();
  formData.append(
    "file",
    { uri: fileUri, type: "audio/m4a", name: "recording.m4a" } as any
  );
  formData.append("model", config.model);

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireProviderKey(provider, apiKey)}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `${PROVIDER_LABELS[provider]} STT error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  const text = data.text?.trim();
  return text ? text : null;
}
