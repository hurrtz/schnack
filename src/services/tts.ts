import * as FileSystem from "expo-file-system/legacy";
import { PROVIDER_LABELS } from "../constants/models";
import { Provider, VoiceBackendMode } from "../types";
import { getTogetherTtsLanguageCode } from "../utils/speechLanguage";

let ttsCounter = 0;

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

function bytesToBase64(bytes: Uint8Array) {
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

  throw new Error("No base64 encoder available.");
}

function base64ToBytes(base64: string) {
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

  throw new Error("No base64 decoder available.");
}

function buildWavBase64FromPcm(params: {
  pcmBase64: string;
  sampleRate: number;
  channels?: number;
  bitsPerSample?: number;
}) {
  const channels = params.channels ?? 1;
  const bitsPerSample = params.bitsPerSample ?? 16;
  const pcmBytes = base64ToBytes(params.pcmBase64);
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
  return bytesToBase64(wavBytes);
}

async function writeBase64AudioFile(base64: string, extension: "mp3" | "wav") {
  const path = `${FileSystem.cacheDirectory}tts-${Date.now()}-${ttsCounter++}.${extension}`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: "base64" });
  return path;
}

function mapVoiceForTogether(voice: string) {
  switch (voice) {
    case "echo":
      return "am_echo";
    case "nova":
      return "af_nova";
    case "onyx":
      return "am_michael";
    case "sage":
      return "bf_emma";
    case "shimmer":
      return "af_bella";
    default:
      return "af_alloy";
  }
}

function mapVoiceForGemini(voice: string) {
  switch (voice) {
    case "echo":
      return "Puck";
    case "fable":
      return "Fenrir";
    case "nova":
      return "Aoede";
    case "onyx":
      return "Charon";
    case "sage":
      return "Sadaltager";
    case "shimmer":
      return "Leda";
    default:
      return "Kore";
  }
}

function mapVoiceForXai(voice: string) {
  switch (voice) {
    case "echo":
      return "rex";
    case "fable":
      return "sam";
    case "nova":
      return "eve";
    case "onyx":
      return "max";
    case "sage":
      return "sal";
    case "shimmer":
      return "zoe";
    case "verse":
      return "leo";
    default:
      return "ara";
  }
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

  if (config.kind === "gemini") {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": requireProviderKey(provider, apiKey),
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
                voiceName: mapVoiceForGemini(voice || config.voiceFallback),
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `${PROVIDER_LABELS[provider]} TTS error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    const audioPart = getGeminiAudioPart(data);
    const pcmBase64 = audioPart?.data;

    if (!pcmBase64) {
      throw new Error(`${PROVIDER_LABELS[provider]} TTS did not return audio.`);
    }

    const mimeType = audioPart?.mimeType as string | undefined;
    const sampleRate =
      Number(mimeType?.match(/rate=(\d+)/i)?.[1]) || 24000;
    const wavBase64 = buildWavBase64FromPcm({
      pcmBase64,
      sampleRate,
    });
    return writeBase64AudioFile(wavBase64, "wav");
  }

  const requestBody =
    provider === "together"
      ? {
          model: config.model,
          voice: mapVoiceForTogether(voice || config.voiceFallback),
          input: text,
          response_format: "mp3",
          language: getTogetherTtsLanguageCode(text),
        }
      : provider === "xai"
        ? {
            model: config.model,
            text,
            voice_id: mapVoiceForXai(voice || config.voiceFallback),
            output_format: {
              codec: "mp3",
              sample_rate: 24000,
              bit_rate: 128000,
            },
          }
        : {
            model: config.model,
            voice: voice || config.voiceFallback,
            input: text,
            response_format: "mp3",
          };

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireProviderKey(provider, apiKey)}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `${PROVIDER_LABELS[provider]} TTS error (${response.status}): ${errorText}`
    );
  }

  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  return writeBase64AudioFile(base64, "mp3");
}
