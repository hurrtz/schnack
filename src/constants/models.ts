export interface ModelInfo {
  id: string;
  name: string;
  releaseDate: string;
}

export const OPENAI_MODELS: ModelInfo[] = [
  { id: "gpt-5.4", name: "GPT-5.4", releaseDate: "2026-03-01" },
  { id: "gpt-5-mini-2025-08-07", name: "GPT-5 Mini", releaseDate: "2025-08-07" },
  { id: "o3", name: "o3", releaseDate: "2025-04-16" },
  { id: "o4-mini", name: "o4 Mini", releaseDate: "2025-04-16" },
  { id: "gpt-4.1", name: "GPT-4.1", releaseDate: "2025-04-14" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", releaseDate: "2025-04-14" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", releaseDate: "2025-04-14" },
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
