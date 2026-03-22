import { PROVIDER_TTS_MAX_INPUT_CHARS } from "./shared";

export function splitIntoSentences(text: string): string[] {
  const result: string[] = [];
  let current = "";

  for (const char of text) {
    current += char;

    if (char === "." || char === "!" || char === "?" || char === "\n") {
      result.push(current);
      current = "";
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}

function splitLongTtsSegment(text: string, maxChars: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  if (normalized.length <= maxChars) {
    return [normalized];
  }

  const chunks: string[] = [];
  const words = normalized.split(/\s+/);
  let current = "";

  const pushCurrent = () => {
    if (current) {
      chunks.push(current);
      current = "";
    }
  };

  for (const word of words) {
    if (!word) {
      continue;
    }

    if (!current) {
      if (word.length <= maxChars) {
        current = word;
      } else {
        for (let index = 0; index < word.length; index += maxChars) {
          chunks.push(word.slice(index, index + maxChars));
        }
      }
      continue;
    }

    const next = `${current} ${word}`;

    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    pushCurrent();

    if (word.length <= maxChars) {
      current = word;
    } else {
      for (let index = 0; index < word.length; index += maxChars) {
        chunks.push(word.slice(index, index + maxChars));
      }
    }
  }

  pushCurrent();
  return chunks;
}

export function splitTextForTts(
  text: string,
  maxChars = PROVIDER_TTS_MAX_INPUT_CHARS,
): string[] {
  const normalized = text.trim();

  if (!normalized) {
    return [];
  }

  const sentenceSegments = splitIntoSentences(normalized);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) {
      chunks.push(current.trim());
      current = "";
    }
  };

  for (const segment of sentenceSegments) {
    const trimmed = segment.replace(/\s+/g, " ").trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed.length > maxChars) {
      pushCurrent();
      chunks.push(...splitLongTtsSegment(trimmed, maxChars));
      continue;
    }

    if (!current) {
      current = trimmed;
      continue;
    }

    const candidate = `${current} ${trimmed}`;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    pushCurrent();
    current = trimmed;
  }

  pushCurrent();
  return chunks;
}
