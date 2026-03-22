import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  PROVIDER_DEFAULT_TTS_MODELS,
  getNativeSttLanguageNote,
  getNativeTtsLanguageNote,
  getProviderSttLanguageNote,
  getProviderSttModelOptions,
  getProviderTtsLanguageNote,
  getProviderTtsModelOptions,
} from "../../constants/models";
import { useSpeechDiagnostics } from "../../hooks/useSpeechDiagnostics";
import { useLocalization } from "../../i18n";
import { TtsListenLanguage } from "../../types";
import {
  getEnabledProviders,
  getEnabledSttProviders,
  getEnabledTtsProviders,
} from "../../utils/providerCapabilities";

import { SettingsModalProps, SettingsTab, TextInputFocusHandler } from "./types";
import { useNativeVoiceOptions } from "./useNativeVoiceOptions";
import { usePreviewTextState } from "./usePreviewTextState";
import { useSettingsKeyboardInset } from "./useSettingsKeyboardInset";
import { useSettingsModalAnimation } from "./useSettingsModalAnimation";
import { useSettingsNormalization } from "./useSettingsNormalization";
import { useVoicePreviewState } from "./useVoicePreviewState";

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
  const speechDiagnostics = useSpeechDiagnostics(6);
  const {
    providerPreviewTexts,
    localPreviewTexts,
    nativePreviewText,
    setProviderPreviewText,
    setLocalPreviewText,
    setNativePreviewText,
  } = usePreviewTextState({
    settings,
    language,
  });

  const enabledProviders = useMemo(() => getEnabledProviders(settings), [settings]);
  const enabledSttProviders = useMemo(
    () => getEnabledSttProviders(settings),
    [settings],
  );
  const enabledTtsProviders = useMemo(
    () => getEnabledTtsProviders(settings),
    [settings],
  );
  const modalAnimStyle = useSettingsModalAnimation(visible);
  const keyboardInset = useSettingsKeyboardInset({
    visible,
    bottomInset: insets.bottom,
  });
  const {
    nativeVoiceOptions,
    selectedNativeVoice,
    setSelectedNativeVoice,
  } = useNativeVoiceOptions({
    visible,
    activeTab,
    language,
  });

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (focusProvider) {
      setActiveTab("providers");
    }
  }, [focusProvider, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, [activeTab, visible]);
  useSettingsNormalization({
    visible,
    settings,
    enabledProviders,
    enabledSttProviders,
    enabledTtsProviders,
    language,
    onUpdate,
  });

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
  const {
    activePreview,
    handlePreviewLocalVoice,
    handlePreviewProviderVoice,
    handlePreviewNativeVoice,
  } = useVoicePreviewState({
    visible,
    settings,
    language,
    providerPreviewTexts,
    localPreviewTexts,
    nativePreviewText,
    selectedNativeVoice,
    onPreviewVoice,
    onStopPreviewVoice,
  });

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
    setProviderPreviewText,
    localPreviewTexts,
    setLocalPreviewText,
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
