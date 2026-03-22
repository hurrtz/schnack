import React, { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, ScrollView } from "react-native";

import * as Speech from "expo-speech";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getLocalTtsVoiceOptions,
  TTS_LISTEN_LANGUAGE_OPTIONS,
} from "../../constants/localTts";
import {
  PROVIDER_DEFAULT_TTS_MODELS,
  PROVIDER_DEFAULT_TTS_VOICES,
  getNativeSttLanguageNote,
  getNativeTtsLanguageNote,
  getProviderSttLanguageNote,
  getProviderSttModelOptions,
  getProviderTtsLanguageNote,
  getProviderTtsModelOptions,
  getProviderTtsVoiceOptions,
} from "../../constants/models";
import { useSpeechDiagnostics } from "../../hooks/useSpeechDiagnostics";
import { useLocalization } from "../../i18n";
import { Provider, TtsListenLanguage, VoicePreviewRequest } from "../../types";
import {
  getEnabledProviders,
  getEnabledSttProviders,
  getEnabledTtsProviders,
} from "../../utils/providerCapabilities";

import {
  getLocalPreviewSampleText,
  getNativePreviewSampleText,
  getNativeVoiceOptionLabel,
  getProviderPreviewSampleText,
  normalizeNativeVoices,
} from "./helpers";
import {
  getNormalizedLocalTtsVoices,
  getNormalizedProviderSttModels,
  getNormalizedProviderTtsModels,
  getNormalizedProviderTtsVoices,
  getNormalizedResponseModes,
  getNormalizedSttProvider,
  getNormalizedTtsProvider,
} from "./settingsRules";
import { NativeSpeechVoice, PreviewButtonPhase, SettingsModalProps, SettingsTab, TextInputFocusHandler } from "./types";

export function useSettingsModalController({
  visible,
  focusProvider,
  settings,
  onUpdate,
  onPreviewVoice,
  onStopPreviewVoice,
}: Pick<
  SettingsModalProps,
  | "visible"
  | "focusProvider"
  | "settings"
  | "onUpdate"
  | "onPreviewVoice"
  | "onStopPreviewVoice"
>) {
  const { t, language } = useLocalization();
  const insets = useSafeAreaInsets();
  const contentScrollRef = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("instructions");
  const [providerPreviewTexts, setProviderPreviewTexts] = useState<
    Record<Provider, Record<TtsListenLanguage, string>>
  >(
    () =>
      Object.fromEntries(
        (Object.keys(settings.apiKeys) as Provider[]).map((provider) => [
          provider,
          Object.fromEntries(
            TTS_LISTEN_LANGUAGE_OPTIONS.map((entry) => [
              entry,
              getProviderPreviewSampleText(entry),
            ]),
          ),
        ]),
      ) as Record<Provider, Record<TtsListenLanguage, string>>,
  );
  const [localPreviewTexts, setLocalPreviewTexts] = useState<
    Record<TtsListenLanguage, string>
  >(
    () =>
      Object.fromEntries(
        TTS_LISTEN_LANGUAGE_OPTIONS.map((entry) => [
          entry,
          getLocalPreviewSampleText(entry),
        ]),
      ) as Record<TtsListenLanguage, string>,
  );
  const [nativePreviewText, setNativePreviewText] = useState(
    getNativePreviewSampleText(language),
  );
  const [nativeVoices, setNativeVoices] = useState<NativeSpeechVoice[]>([]);
  const [selectedNativeVoice, setSelectedNativeVoice] = useState("");
  const [activePreview, setActivePreview] = useState<{
    id: string;
    phase: PreviewButtonPhase;
  } | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const speechDiagnostics = useSpeechDiagnostics(6);

  const enabledProviders = useMemo(() => getEnabledProviders(settings), [settings]);
  const enabledSttProviders = useMemo(
    () => getEnabledSttProviders(settings),
    [settings],
  );
  const enabledTtsProviders = useMemo(
    () => getEnabledTtsProviders(settings),
    [settings],
  );

  const scale = useSharedValue(0.96);
  const translateY = useSharedValue(16);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scale.value = 0.96;
      translateY.value = 16;
      opacity.value = 0;
      setActivePreview(null);
      return;
    }

    if (focusProvider) {
      setActiveTab("providers");
    }

    scale.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.ease),
    });
    translateY.value = withTiming(0, {
      duration: 240,
      easing: Easing.out(Easing.ease),
    });
    opacity.value = withTiming(1, { duration: 220 });
  }, [focusProvider, opacity, scale, translateY, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, [activeTab, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextProvider = getNormalizedSttProvider(settings, enabledSttProviders);

    if (nextProvider !== null) {
      onUpdate({ sttProvider: nextProvider });
    }
  }, [enabledSttProviders, onUpdate, settings, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextResponseModes = getNormalizedResponseModes(
      settings,
      enabledProviders,
    );

    if (nextResponseModes) {
      onUpdate({ responseModes: nextResponseModes });
    }
  }, [enabledProviders, onUpdate, settings, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextProvider = getNormalizedTtsProvider(settings, enabledTtsProviders);

    if (nextProvider !== null) {
      onUpdate({ ttsProvider: nextProvider });
    }
  }, [enabledTtsProviders, onUpdate, settings, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextProviderSttModels = getNormalizedProviderSttModels(
      settings,
      enabledSttProviders,
    );

    if (nextProviderSttModels) {
      onUpdate({ providerSttModels: nextProviderSttModels });
    }
  }, [enabledSttProviders, onUpdate, settings, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextProviderTtsModels = getNormalizedProviderTtsModels(
      settings,
      enabledTtsProviders,
    );

    if (nextProviderTtsModels) {
      onUpdate({ providerTtsModels: nextProviderTtsModels });
    }
  }, [enabledTtsProviders, onUpdate, settings, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextProviderTtsVoices = getNormalizedProviderTtsVoices(
      settings,
      enabledTtsProviders,
      language,
    );

    if (nextProviderTtsVoices) {
      onUpdate({ providerTtsVoices: nextProviderTtsVoices });
    }
  }, [enabledTtsProviders, language, onUpdate, settings, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextLocalTtsVoices = getNormalizedLocalTtsVoices(settings);

    if (nextLocalTtsVoices) {
      onUpdate({ localTtsVoices: nextLocalTtsVoices });
    }
  }, [onUpdate, settings, visible]);

  useEffect(() => {
    const localizedSample = getNativePreviewSampleText(language);

    setNativePreviewText((previous) =>
      previous === getNativePreviewSampleText("en") ||
      previous === getNativePreviewSampleText("de")
        ? localizedSample
        : previous,
    );
  }, [language]);

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

  useEffect(() => {
    if (!visible) {
      setKeyboardInset(0);
      return;
    }

    const updateInset = (height: number) => {
      setKeyboardInset(Math.max(height - insets.bottom, 0));
    };

    const handleKeyboardShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => updateInset(event.endCoordinates.height),
    );
    const handleKeyboardHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => updateInset(0),
    );
    const handleKeyboardFrameChange =
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardWillChangeFrame", (event) =>
            updateInset(event.endCoordinates.height),
          )
        : null;

    return () => {
      handleKeyboardShow.remove();
      handleKeyboardHide.remove();
      handleKeyboardFrameChange?.remove();
    };
  }, [insets.bottom, visible]);

  const modalAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handleTextInputFocus = React.useCallback<TextInputFocusHandler>(
    (event) => {
      const target = Number(event.target);
      const scrollResponder = (
        contentScrollRef.current as ScrollView & {
          getScrollResponder?: () => {
            scrollResponderScrollNativeHandleToKeyboard?: (
              nodeHandle: number,
              additionalOffset?: number,
              preventNegativeScrollOffset?: boolean,
            ) => void;
          };
        }
      ).getScrollResponder?.();

      if (
        !target ||
        !scrollResponder?.scrollResponderScrollNativeHandleToKeyboard
      ) {
        return;
      }

      setTimeout(
        () => {
          scrollResponder.scrollResponderScrollNativeHandleToKeyboard?.(
            target,
            96,
            true,
          );
        },
        Platform.OS === "ios" ? 80 : 40,
      );
    },
    [],
  );

  const handleExactPreview = async (
    previewId: string,
    request: VoicePreviewRequest,
  ) => {
    const trimmed = request.text.trim();

    if (!trimmed) {
      return;
    }

    if (activePreview?.id === previewId) {
      setActivePreview(null);
      await onStopPreviewVoice();
      return;
    }

    if (activePreview) {
      return;
    }

    setActivePreview({ id: previewId, phase: "generating" });
    try {
      await onPreviewVoice(
        {
          ...request,
          text: trimmed,
        },
        {
          onPlaybackStarted: () => {
            setActivePreview((current) =>
              current?.id === previewId
                ? { id: previewId, phase: "playing" }
                : current,
            );
          },
        },
      );
    } finally {
      setActivePreview((current) =>
        current?.id === previewId ? null : current,
      );
    }
  };

  const handlePreviewLocalVoice = async (
    selectedLanguage: TtsListenLanguage,
  ) => {
    const selectedVoice =
      settings.localTtsVoices[selectedLanguage] ||
      getLocalTtsVoiceOptions(selectedLanguage)[0]?.value ||
      "";

    await handleExactPreview(`local:${selectedLanguage}`, {
      text: localPreviewTexts[selectedLanguage],
      mode: "local",
      localLanguage: selectedLanguage,
      voice: selectedVoice,
    });
  };

  const handlePreviewProviderVoice = async (
    provider: Provider,
    previewLanguage: TtsListenLanguage,
  ) => {
    const selectedVoice =
      settings.providerTtsVoices[provider] ||
      PROVIDER_DEFAULT_TTS_VOICES[provider] ||
      getProviderTtsVoiceOptions(provider, language)[0]?.id ||
      "";

    await handleExactPreview(`provider:${provider}:${previewLanguage}`, {
      text: providerPreviewTexts[provider][previewLanguage],
      mode: "provider",
      provider,
      voice: selectedVoice,
      previewLanguage,
    });
  };

  const handlePreviewNativeVoice = async () => {
    await handleExactPreview("native", {
      text: nativePreviewText,
      mode: "native",
      nativeVoice: selectedNativeVoice || undefined,
    });
  };

  const providerPickerDisabled =
    settings.sttMode !== "provider" || enabledSttProviders.length === 0;
  const ttsProviderPickerDisabled =
    settings.ttsMode === "native" || enabledTtsProviders.length === 0;
  const selectedSttProviderModelOptions =
    settings.sttProvider &&
    enabledSttProviders.includes(settings.sttProvider)
      ? getProviderSttModelOptions(settings.sttProvider)
      : [];
  const selectedSttProviderModel =
    settings.sttProvider &&
    enabledSttProviders.includes(settings.sttProvider)
      ? settings.providerSttModels[settings.sttProvider] ||
        selectedSttProviderModelOptions[0]?.id ||
        ""
      : "";
  const sttLanguageNote =
    settings.sttMode === "native"
      ? getNativeSttLanguageNote(language)
      : settings.sttProvider
        ? getProviderSttLanguageNote(settings.sttProvider, language)
        : null;
  const ttsLanguageNote =
    settings.ttsMode === "native"
      ? getNativeTtsLanguageNote(language)
      : settings.ttsMode === "local"
        ? t("localTtsLanguageCoverageHint")
        : settings.ttsProvider
          ? getProviderTtsLanguageNote(settings.ttsProvider, language)
          : null;
  const selectedPreviewProvider =
    settings.ttsProvider && enabledTtsProviders.includes(settings.ttsProvider)
      ? settings.ttsProvider
      : null;
  const selectedPreviewProviderModelOptions = selectedPreviewProvider
    ? getProviderTtsModelOptions(selectedPreviewProvider)
    : [];
  const selectedPreviewProviderModel =
    selectedPreviewProvider
      ? settings.providerTtsModels[selectedPreviewProvider] ||
        PROVIDER_DEFAULT_TTS_MODELS[selectedPreviewProvider] ||
        selectedPreviewProviderModelOptions[0]?.id ||
        ""
      : "";
  const nativeVoiceOptions = nativeVoices.map((voice) => ({
    value: voice.identifier,
    label: getNativeVoiceOptionLabel(voice),
  }));
  const toggleListenLanguage = (value: TtsListenLanguage) => {
    const exists = settings.ttsListenLanguages.includes(value);

    if (exists && settings.ttsListenLanguages.length === 1) {
      return;
    }

    onUpdate({
      ttsListenLanguages: exists
        ? settings.ttsListenLanguages.filter((entry) => entry !== value)
        : [...settings.ttsListenLanguages, value],
    });
  };

  return {
    contentScrollRef,
    activeTab,
    setActiveTab,
    providerPreviewTexts,
    setProviderPreviewTexts,
    localPreviewTexts,
    setLocalPreviewTexts,
    nativePreviewText,
    setNativePreviewText,
    activePreview,
    keyboardInset,
    speechDiagnostics,
    enabledProviders,
    enabledSttProviders,
    enabledTtsProviders,
    modalAnimStyle,
    handleTextInputFocus,
    handlePreviewLocalVoice,
    handlePreviewProviderVoice,
    handlePreviewNativeVoice,
    providerPickerDisabled,
    ttsProviderPickerDisabled,
    selectedSttProviderModelOptions,
    selectedSttProviderModel,
    sttLanguageNote,
    ttsLanguageNote,
    selectedPreviewProvider,
    selectedPreviewProviderModelOptions,
    selectedPreviewProviderModel,
    nativeVoiceOptions,
    selectedNativeVoice,
    setSelectedNativeVoice,
    toggleListenLanguage,
  };
}
