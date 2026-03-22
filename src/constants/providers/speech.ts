import { AppLanguage, Provider } from "../../types";
import type { ModelInfo, TtsVoiceOption } from "./types";

export const PROVIDER_STT_MODEL_OPTIONS: Partial<Record<Provider, ModelInfo[]>> = {
  openai: [
    { id: "gpt-4o-transcribe", name: "GPT-4o Transcribe" },
    { id: "gpt-4o-mini-transcribe", name: "GPT-4o Mini Transcribe" },
    { id: "whisper-1", name: "Whisper-1" },
  ],
  gemini: [
    { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" },
    {
      id: "gemini-3.1-flash-lite-preview",
      name: "Gemini 3.1 Flash-Lite Preview",
    },
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash-Lite" },
  ],
  groq: [
    { id: "whisper-large-v3-turbo", name: "Whisper Large v3 Turbo" },
    { id: "whisper-large-v3", name: "Whisper Large v3" },
  ],
  mistral: [{ id: "voxtral-mini-latest", name: "Voxtral Mini Latest" }],
  together: [
    { id: "openai/whisper-large-v3", name: "Whisper Large v3" },
    {
      id: "mistralai/Voxtral-Mini-3B-2507",
      name: "Voxtral Mini 3B",
    },
  ],
};

export const PROVIDER_DEFAULT_STT_MODELS: Partial<Record<Provider, string>> = {
  openai: "gpt-4o-mini-transcribe",
  gemini: "gemini-2.5-flash",
  groq: "whisper-large-v3-turbo",
  mistral: "voxtral-mini-latest",
  together: "openai/whisper-large-v3",
};

export function getProviderSttModelOptions(provider: Provider) {
  return PROVIDER_STT_MODEL_OPTIONS[provider] ?? [];
}

export function getSttModelLabel(provider: Provider, modelId: string) {
  const option = getProviderSttModelOptions(provider).find(
    (model) => model.id === modelId,
  );
  return option?.name ?? modelId;
}

export const OPENAI_TTS_VOICES: TtsVoiceOption[] = [
  { id: "alloy", label: "Alloy" },
  { id: "ash", label: "Ash" },
  { id: "ballad", label: "Ballad" },
  { id: "cedar", label: "Cedar" },
  { id: "coral", label: "Coral" },
  { id: "echo", label: "Echo" },
  { id: "fable", label: "Fable" },
  { id: "marin", label: "Marin" },
  { id: "onyx", label: "Onyx" },
  { id: "nova", label: "Nova" },
  { id: "sage", label: "Sage" },
  { id: "shimmer", label: "Shimmer" },
  { id: "verse", label: "Verse" },
];

export const GEMINI_TTS_VOICES: TtsVoiceOption[] = [
  { id: "Zephyr", label: "Zephyr · Bright" },
  { id: "Puck", label: "Puck · Upbeat" },
  { id: "Charon", label: "Charon · Informative" },
  { id: "Kore", label: "Kore · Firm" },
  { id: "Fenrir", label: "Fenrir · Excitable" },
  { id: "Leda", label: "Leda · Youthful" },
  { id: "Orus", label: "Orus · Firm" },
  { id: "Aoede", label: "Aoede · Breezy" },
  { id: "Callirrhoe", label: "Callirrhoe · Easy-going" },
  { id: "Autonoe", label: "Autonoe · Bright" },
  { id: "Enceladus", label: "Enceladus · Breathy" },
  { id: "Iapetus", label: "Iapetus · Clear" },
  { id: "Umbriel", label: "Umbriel · Easy-going" },
  { id: "Algieba", label: "Algieba · Smooth" },
  { id: "Despina", label: "Despina · Smooth" },
  { id: "Erinome", label: "Erinome · Clear" },
  { id: "Algenib", label: "Algenib · Gravelly" },
  { id: "Rasalgethi", label: "Rasalgethi · Informative" },
  { id: "Laomedeia", label: "Laomedeia · Upbeat" },
  { id: "Achernar", label: "Achernar · Soft" },
  { id: "Alnilam", label: "Alnilam · Firm" },
  { id: "Schedar", label: "Schedar · Even" },
  { id: "Gacrux", label: "Gacrux · Mature" },
  { id: "Pulcherrima", label: "Pulcherrima · Forward" },
  { id: "Achird", label: "Achird · Friendly" },
  { id: "Zubenelgenubi", label: "Zubenelgenubi · Casual" },
  { id: "Vindemiatrix", label: "Vindemiatrix · Gentle" },
  { id: "Sadachbia", label: "Sadachbia · Lively" },
  { id: "Sadaltager", label: "Sadaltager · Knowledgeable" },
  { id: "Sulafat", label: "Sulafat · Warm" },
];

export const TOGETHER_TTS_VOICES: TtsVoiceOption[] = [
  { id: "af_heart", label: "af_heart" },
  { id: "af_alloy", label: "af_alloy" },
  { id: "af_aoede", label: "af_aoede" },
  { id: "af_bella", label: "af_bella" },
  { id: "af_jessica", label: "af_jessica" },
  { id: "af_kore", label: "af_kore" },
  { id: "af_nicole", label: "af_nicole" },
  { id: "af_nova", label: "af_nova" },
  { id: "af_river", label: "af_river" },
  { id: "af_sarah", label: "af_sarah" },
  { id: "af_sky", label: "af_sky" },
  { id: "am_adam", label: "am_adam" },
  { id: "am_echo", label: "am_echo" },
  { id: "am_eric", label: "am_eric" },
  { id: "am_fenrir", label: "am_fenrir" },
  { id: "am_liam", label: "am_liam" },
];

export const XAI_TTS_VOICES: TtsVoiceOption[] = [
  { id: "eve", label: "Eve · Energetic" },
  { id: "ara", label: "Ara · Warm" },
  { id: "rex", label: "Rex · Confident" },
  { id: "sal", label: "Sal · Balanced" },
  { id: "leo", label: "Leo · Authoritative" },
];

export const PROVIDER_TTS_VOICE_OPTIONS: Partial<Record<Provider, TtsVoiceOption[]>> = {
  openai: OPENAI_TTS_VOICES,
  gemini: GEMINI_TTS_VOICES,
  together: TOGETHER_TTS_VOICES,
  xai: XAI_TTS_VOICES,
};

export const PROVIDER_DEFAULT_TTS_VOICES: Partial<Record<Provider, string>> = {
  openai: "alloy",
  gemini: "Kore",
  together: "af_alloy",
  xai: "ara",
};

export const PROVIDER_TTS_MODEL_OPTIONS: Partial<Record<Provider, ModelInfo[]>> = {
  openai: [
    { id: "gpt-4o-mini-tts", name: "GPT-4o Mini TTS" },
    { id: "tts-1", name: "tts-1" },
    { id: "tts-1-hd", name: "tts-1-hd" },
  ],
  gemini: [
    {
      id: "gemini-2.5-flash-preview-tts",
      name: "Gemini 2.5 Flash Preview TTS",
    },
    {
      id: "gemini-2.5-pro-preview-tts",
      name: "Gemini 2.5 Pro Preview TTS",
    },
  ],
  together: [{ id: "hexgrad/Kokoro-82M", name: "Kokoro 82M" }],
};

export const PROVIDER_DEFAULT_TTS_MODELS: Partial<Record<Provider, string>> = {
  openai: "gpt-4o-mini-tts",
  gemini: "gemini-2.5-flash-preview-tts",
  together: "hexgrad/Kokoro-82M",
  xai: "grok-tts-mini",
};

function localizeVoiceOptions(
  options: TtsVoiceOption[],
  labels: Partial<Record<string, string>>,
) {
  return options.map((option) => ({
    ...option,
    label: labels[option.id] ?? option.label,
  }));
}

export function getProviderTtsVoiceOptions(
  provider: Provider,
  language: AppLanguage,
) {
  if (language === "en") {
    return PROVIDER_TTS_VOICE_OPTIONS[provider] ?? [];
  }

  switch (provider) {
    case "gemini":
      return localizeVoiceOptions(GEMINI_TTS_VOICES, {
        Zephyr: "Zephyr · Klar",
        Puck: "Puck · Schwungvoll",
        Charon: "Charon · Informativ",
        Kore: "Kore · Bestimmt",
        Fenrir: "Fenrir · Temperamentvoll",
        Leda: "Leda · Jugendlich",
        Orus: "Orus · Bestimmt",
        Aoede: "Aoede · Leicht",
        Callirrhoe: "Callirrhoe · Gelassen",
        Autonoe: "Autonoe · Klar",
        Enceladus: "Enceladus · Hauchig",
        Iapetus: "Iapetus · Klar",
        Umbriel: "Umbriel · Gelassen",
        Algieba: "Algieba · Sanft",
        Despina: "Despina · Sanft",
        Erinome: "Erinome · Klar",
        Algenib: "Algenib · Rau",
        Rasalgethi: "Rasalgethi · Informativ",
        Laomedeia: "Laomedeia · Schwungvoll",
        Achernar: "Achernar · Weich",
        Alnilam: "Alnilam · Bestimmt",
        Schedar: "Schedar · Gleichmaessig",
        Gacrux: "Gacrux · Reif",
        Pulcherrima: "Pulcherrima · Direkt",
        Achird: "Achird · Freundlich",
        Zubenelgenubi: "Zubenelgenubi · Locker",
        Vindemiatrix: "Vindemiatrix · Sanft",
        Sadachbia: "Sadachbia · Lebhaft",
        Sadaltager: "Sadaltager · Kenntnisreich",
        Sulafat: "Sulafat · Warm",
      });
    case "xai":
      return localizeVoiceOptions(XAI_TTS_VOICES, {
        eve: "Eve · Energetisch",
        ara: "Ara · Warm",
        rex: "Rex · Souveraen",
        sal: "Sal · Ausgewogen",
        leo: "Leo · Autoritaer",
      });
    default:
      return PROVIDER_TTS_VOICE_OPTIONS[provider] ?? [];
  }
}

export function getProviderTtsModelOptions(provider: Provider) {
  return PROVIDER_TTS_MODEL_OPTIONS[provider] ?? [];
}

export function getTtsModelLabel(provider: Provider, modelId: string) {
  const option = getProviderTtsModelOptions(provider).find(
    (model) => model.id === modelId,
  );
  return option?.name ?? modelId;
}

export function getTtsVoiceLabel(
  provider: Provider,
  voiceId: string,
  language: AppLanguage = "en",
) {
  const option = getProviderTtsVoiceOptions(provider, language).find(
    (voice) => voice.id === voiceId,
  );
  return option?.label ?? voiceId;
}
