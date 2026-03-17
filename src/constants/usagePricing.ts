import { Provider } from "../types";

export interface PricingAssumption {
  provider: Provider;
  modelPattern: RegExp;
  modelLabel: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  sourceLabel: string;
  sourceUrl: string;
  checkedAt: string;
}

export const PRICING_ASSUMPTIONS_LAST_UPDATED = "2026-03-17";

export const PRICING_ASSUMPTIONS: PricingAssumption[] = [
  {
    provider: "openai",
    modelPattern: /^gpt-5\.4$/,
    modelLabel: "GPT-5.4",
    inputUsdPerMillion: 2.5,
    outputUsdPerMillion: 15,
    sourceLabel: "OpenAI API pricing",
    sourceUrl: "https://developers.openai.com/api/docs/pricing",
    checkedAt: "2026-03-17",
  },
  {
    provider: "anthropic",
    modelPattern: /^claude-sonnet-4/,
    modelLabel: "Claude Sonnet 4",
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
    sourceLabel: "Anthropic pricing",
    sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/pricing",
    checkedAt: "2026-03-17",
  },
  {
    provider: "gemini",
    modelPattern: /^gemini-2\.5-flash$/,
    modelLabel: "Gemini 2.5 Flash",
    inputUsdPerMillion: 0.3,
    outputUsdPerMillion: 2.5,
    sourceLabel: "Gemini API pricing",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/pricing",
    checkedAt: "2026-03-17",
  },
  {
    provider: "cohere",
    modelPattern: /^command-a-03-2025$/,
    modelLabel: "Command A",
    inputUsdPerMillion: 1,
    outputUsdPerMillion: 2,
    sourceLabel: "Cohere pricing",
    sourceUrl: "https://cohere.com/pricing",
    checkedAt: "2026-03-17",
  },
  {
    provider: "deepseek",
    modelPattern: /^deepseek-chat$/,
    modelLabel: "DeepSeek Chat",
    inputUsdPerMillion: 0.28,
    outputUsdPerMillion: 0.42,
    sourceLabel: "DeepSeek models and pricing",
    sourceUrl: "https://api-docs.deepseek.com/quick_start/pricing/",
    checkedAt: "2026-03-17",
  },
  {
    provider: "groq",
    modelPattern: /^llama-3\.3-70b-versatile$/,
    modelLabel: "Llama 3.3 70B Versatile",
    inputUsdPerMillion: 0.59,
    outputUsdPerMillion: 0.79,
    sourceLabel: "Groq supported models",
    sourceUrl: "https://console.groq.com/docs/models",
    checkedAt: "2026-03-17",
  },
];
