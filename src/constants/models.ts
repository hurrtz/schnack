export interface ModelInfo {
  id: string;
  name: string;
  releaseDate: string;
}

export const OPENAI_MODELS: ModelInfo[] = [
  { id: "gpt-4.1", name: "GPT-4.1", releaseDate: "2025-04-14" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", releaseDate: "2025-04-14" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", releaseDate: "2025-04-14" },
  { id: "gpt-4o", name: "GPT-4o", releaseDate: "2025-03-25" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", releaseDate: "2024-07-18" },
  { id: "o3", name: "o3", releaseDate: "2025-04-16" },
  { id: "o3-mini", name: "o3 Mini", releaseDate: "2025-01-31" },
  { id: "o4-mini", name: "o4 Mini", releaseDate: "2025-04-16" },
];

export const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", releaseDate: "2025-06-25" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", releaseDate: "2025-06-25" },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", releaseDate: "2025-10-01" },
];

export const TTS_VOICES = [
  "alloy", "ash", "ballad", "coral", "echo", "fable",
  "onyx", "nova", "sage", "shimmer", "verse",
] as const;

export type TtsVoice = (typeof TTS_VOICES)[number];
