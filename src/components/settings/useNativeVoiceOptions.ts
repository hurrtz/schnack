import { useEffect, useMemo, useState } from "react";

import * as Speech from "expo-speech";

import { AppLanguage } from "../../types";

import { getNativeVoiceOptionLabel, normalizeNativeVoices } from "./helpers";
import { NativeSpeechVoice } from "./types";

export function useNativeVoiceOptions(params: {
  visible: boolean;
  activeTab: string;
  language: AppLanguage;
}) {
  const { visible, activeTab, language } = params;
  const [nativeVoices, setNativeVoices] = useState<NativeSpeechVoice[]>([]);
  const [selectedNativeVoice, setSelectedNativeVoice] = useState("");

  useEffect(() => {
    if (!visible || activeTab !== "tts") {
      return;
    }

    let cancelled = false;
    const preferredLanguagePrefix = language === "de" ? "de" : "en";

    void Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (cancelled) {
          return;
        }

        const sortedVoices = normalizeNativeVoices(voices).sort(
          (left, right) => {
            const leftLanguage = left.language.toLowerCase();
            const rightLanguage = right.language.toLowerCase();
            const leftLanguageMatches = leftLanguage.startsWith(
              preferredLanguagePrefix,
            );
            const rightLanguageMatches = rightLanguage.startsWith(
              preferredLanguagePrefix,
            );

            if (leftLanguageMatches !== rightLanguageMatches) {
              return leftLanguageMatches ? -1 : 1;
            }

            if (left.quality !== right.quality) {
              return left.quality === "Enhanced" ? -1 : 1;
            }

            const languageComparison = left.language.localeCompare(
              right.language,
            );

            if (languageComparison !== 0) {
              return languageComparison;
            }

            return left.name.localeCompare(right.name);
          },
        );

        setNativeVoices(sortedVoices);
        setSelectedNativeVoice((previous) => {
          if (
            previous &&
            sortedVoices.some((voice) => voice.identifier === previous)
          ) {
            return previous;
          }

          return sortedVoices[0]?.identifier ?? "";
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setNativeVoices([]);
        setSelectedNativeVoice("");
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, language, visible]);

  const nativeVoiceOptions = useMemo(
    () =>
      nativeVoices.map((voice) => ({
        value: voice.identifier,
        label: getNativeVoiceOptionLabel(voice),
      })),
    [nativeVoices],
  );

  return {
    nativeVoices,
    nativeVoiceOptions,
    selectedNativeVoice,
    setSelectedNativeVoice,
  };
}
