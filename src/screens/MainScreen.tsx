import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  AppState,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ChatTranscript } from "../components/ChatTranscript";
import { ConversationMemoryModal } from "../components/ConversationMemoryModal";
import { ConversationDrawer } from "../components/ConversationDrawer";
import { ResponseModeToggle } from "../components/ResponseModeToggle";
import { SettingsModal } from "../components/SettingsModal";
import { SetupGuideModal } from "../components/SetupGuideModal";
import { Toast } from "../components/Toast";
import { ProviderIcon } from "../components/ProviderIcon";
import { WaveformBar } from "../components/WaveformBar";
import { WaveformCircle } from "../components/WaveformCircle";
import { getTtsListenLanguageLabel } from "../constants/localTts";
import {
  getProviderSttModelOptions,
  getProviderTtsModelOptions,
  getSttModelLabel,
  getTtsVoiceLabel,
  getTtsModelLabel,
  getProviderModelName,
  PROVIDER_DEFAULT_STT_MODELS,
  PROVIDER_DEFAULT_TTS_MODELS,
  PROVIDER_DEFAULT_TTS_VOICES,
  PROVIDER_LABELS,
} from "../constants/models";
import { useSharedSettings } from "../context/SettingsContext";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useLocalTtsPacks } from "../hooks/useLocalTtsPacks";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useNativeSpeechRecognizer } from "../hooks/useNativeSpeechRecognizer";
import { useConversations } from "../hooks/useConversations";
import { useVoicePipeline } from "../hooks/useVoicePipeline";
import { useLocalization } from "../i18n";
import { validateProviderConnection } from "../services/llm";
import { createSpeechRequestId } from "../services/speech/diagnostics";
import {
  getLocalTtsInstallStatus,
  releaseLocalTtsResources,
} from "../services/localTts";
import { synthesizeSpeech } from "../services/tts";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import {
  Provider,
  ResponseMode,
  TtsListenLanguage,
  VoicePreviewRequest,
  VoiceVisualPhase,
  WaveformVisualizationVariant,
} from "../types";
import {
  getEnabledSttProviders,
  getEnabledTtsProviders,
} from "../utils/providerCapabilities";
import {
  getAvailableResponseModes,
  getProviderValidationModel,
} from "../utils/responseModes";
import {
  aggregateConversationUsage,
  aggregateConversationUsageByRoute,
  formatTokenCount,
  formatUsd,
} from "../utils/usageStats";
import { ConversationMenu } from "./main/ConversationMenu";
import { MainScreenTopBar } from "./main/MainScreenTopBar";
import { useConversationActions } from "./main/useConversationActions";
import { useMainScreenUiState } from "./main/useMainScreenUiState";

function getResponseModeLabel(
  mode: ResponseMode,
  t: ReturnType<typeof useLocalization>["t"],
) {
  switch (mode) {
    case "quick":
      return t("quickAndShallow");
    case "normal":
      return t("normal");
    case "deep":
      return t("deepThinking");
  }
}

export function MainScreen() {
  const { colors, isDark } = useTheme();
  const { t, language } = useLocalization();
  const insets = useSafeAreaInsets();
  const {
    settings,
    updateSettings,
    updateActiveResponseMode,
    updateResponseModeRoute,
    updateProviderSttModel,
    updateProviderTtsModel,
    updateProviderTtsVoice,
    updateLocalTtsVoice,
    updateApiKey,
    loaded,
  } = useSharedSettings();
  const {
    conversations,
    activeConversation,
    createConversation,
    selectConversation,
    getConversationById,
    addMessage,
    updateConversationContextSummary,
    clearConversationMemory,
    renameConversation,
    toggleConversationPinned,
    searchConversations,
    deleteConversation,
    clearActiveConversation,
    captureActiveConversationSnapshot,
    restoreActiveConversationSnapshot,
  } = useConversations();

  const recorder = useAudioRecorder();
  const nativeStt = useNativeSpeechRecognizer();
  const player = useAudioPlayer();
  const {
    packStates: localTtsPackStates,
    installLanguagePack,
    refreshPackStates: refreshLocalTtsPackStates,
  } = useLocalTtsPacks(settings);

  const [toast, setToast] = useState<{
    message: string;
    onRetry?: () => void;
  } | null>(null);
  const {
    settingsVisible,
    settingsFocusProvider,
    drawerVisible,
    statusDetailsVisible,
    transcriptVisible,
    conversationMenuVisible,
    setupGuideVisible,
    memoryConversation,
    memoryVisible,
    setDrawerVisible,
    setSetupGuideVisible,
    setMemoryConversation,
    openSettings,
    closeSettings,
    openMemoryConversation,
    closeMemory,
    openTranscript,
    closeTranscript,
    openStatusDetails,
    closeStatusDetails,
    closeConversationMenu,
    toggleConversationMenu,
    runAfterDrawerDismiss,
    handleDrawerDismiss,
  } = useMainScreenUiState();

  const recordingStartedRef = useRef<Promise<void> | null>(null);
  const voiceTurnSessionRef = useRef(0);
  const voiceTurnSnapshotRef = useRef<ReturnType<
    typeof captureActiveConversationSnapshot
  > | null>(null);
  const cancelableVoiceTurnSessionRef = useRef<number | null>(null);
  const previewSessionRef = useRef(0);
  const previewAbortRef = useRef<AbortController | null>(null);

  const activeResponseMode = settings.activeResponseMode;
  const activeResponseRoute = settings.responseModes[activeResponseMode];
  const provider = activeResponseRoute.provider;
  const providerApiKey = settings.apiKeys[provider].trim();
  const model = activeResponseRoute.model;
  const availableResponseModes = getAvailableResponseModes(settings);
  const availableSttProviders = getEnabledSttProviders(settings);
  const availableTtsProviders = getEnabledTtsProviders(settings);
  const sttProvider =
    settings.sttMode === "provider" ? settings.sttProvider : null;
  const ttsProvider = settings.ttsProvider;
  const sttApiKey = sttProvider ? settings.apiKeys[sttProvider].trim() : "";
  const ttsApiKey = ttsProvider ? settings.apiKeys[ttsProvider].trim() : "";
  const selectedSttModel = sttProvider
    ? settings.providerSttModels[sttProvider] ||
      PROVIDER_DEFAULT_STT_MODELS[sttProvider] ||
      ""
    : "";
  const sttStatusLabel =
    settings.sttMode === "native"
      ? t("appNative")
      : sttProvider
        ? `${PROVIDER_LABELS[sttProvider]}${
            getProviderSttModelOptions(sttProvider).length > 1 &&
            selectedSttModel
              ? ` · ${getSttModelLabel(sttProvider, selectedSttModel)}`
              : ""
          }`
        : t("noProviderYet");
  const selectedTtsVoice = ttsProvider
    ? settings.providerTtsVoices[ttsProvider] ||
      PROVIDER_DEFAULT_TTS_VOICES[ttsProvider] ||
      ""
    : "";
  const selectedTtsModel = ttsProvider
    ? settings.providerTtsModels[ttsProvider] ||
      PROVIDER_DEFAULT_TTS_MODELS[ttsProvider] ||
      ""
    : "";
  const providerLabel = PROVIDER_LABELS[provider];
  const modelLabel = getProviderModelName(provider, model);
  const responseModeLabel = getResponseModeLabel(activeResponseMode, t);
  const isRecording =
    settings.sttMode === "native"
      ? nativeStt.isRecording
      : recorder.isRecording;
  const recordingMetering =
    settings.sttMode === "native"
      ? nativeStt.meteringData
      : recorder.meteringData;
  const recordingLevels =
    settings.sttMode === "native"
      ? nativeStt.waveformData
      : recorder.waveformData;
  const recordingWaveformVariant: WaveformVisualizationVariant =
    settings.sttMode === "native"
      ? (nativeStt.waveformVariant as WaveformVisualizationVariant)
      : (recorder.waveformVariant as WaveformVisualizationVariant);
  const ttsStatusLabel =
    settings.ttsMode === "native"
      ? t("systemVoice")
      : settings.ttsMode === "local"
        ? `${t("localTts")} · ${settings.ttsListenLanguages
            .map((entry) => getTtsListenLanguageLabel(entry, language))
            .join(", ")}`
        : ttsProvider
          ? `${PROVIDER_LABELS[ttsProvider]}${
              getProviderTtsModelOptions(ttsProvider).length > 1 &&
              selectedTtsModel
                ? ` · ${getTtsModelLabel(ttsProvider, selectedTtsModel)}`
                : ""
            } · ${getTtsVoiceLabel(ttsProvider, selectedTtsVoice, language)}`
          : t("noTtsProvider");
  const readyLocalFallbackLanguages = settings.ttsListenLanguages.filter(
    (entry) =>
      localTtsPackStates[entry]?.supported &&
      localTtsPackStates[entry]?.downloaded &&
      localTtsPackStates[entry]?.verified,
  );
  const localFallbackStatusLabel =
    readyLocalFallbackLanguages.length > 0
      ? `${t("localTts")} · ${readyLocalFallbackLanguages
          .map((entry) => getTtsListenLanguageLabel(entry, language))
          .join(", ")}`
      : null;
  const providerFallbackStatusLabel =
    ttsProvider &&
    availableTtsProviders.includes(ttsProvider) &&
    ttsApiKey
      ? `${PROVIDER_LABELS[ttsProvider]}${
          getProviderTtsModelOptions(ttsProvider).length > 1 && selectedTtsModel
            ? ` · ${getTtsModelLabel(ttsProvider, selectedTtsModel)}`
            : ""
        } · ${getTtsVoiceLabel(ttsProvider, selectedTtsVoice, language)}`
      : null;
  const fallbackTtsStatusLabel =
    settings.ttsMode === "local"
      ? providerFallbackStatusLabel
      : settings.ttsMode === "provider"
        ? localFallbackStatusLabel
        : null;
  const metering = isRecording
    ? recordingMetering
    : player.isPlaying
      ? player.meteringData
      : -160;
  const signalLevels = isRecording
    ? recordingLevels
    : player.isPlaying
      ? player.waveformData
      : undefined;
  const signalWaveformVariant: WaveformVisualizationVariant = isRecording
    ? recordingWaveformVariant
    : player.isPlaying
      ? (player.waveformVariant as WaveformVisualizationVariant)
      : "bars";

  const showToast = useCallback((message: string, onRetry?: () => void) => {
    setToast({ message, onRetry });
  }, []);

  const {
    pipelinePhase,
    setPipelinePhase,
    streamingText,
    setStreamingText,
    abortRef,
    lastCompletedReplyRef,
    replayPhase,
    activeReplayMessageId,
    handleRepeatLastReply,
    stopReplay,
    handleVoiceCaptureDone,
  } = useVoicePipeline({
    activeConversation,
    addMessage,
    createConversation,
    updateConversationContextSummary,
    player,
    provider,
    providerApiKey,
    model,
    sttMode: settings.sttMode,
    sttProvider,
    sttApiKey,
    selectedSttModel,
    selectedTtsModel,
    ttsMode: settings.ttsMode,
    ttsProvider,
    ttsApiKey,
    selectedTtsVoice,
    ttsListenLanguages: settings.ttsListenLanguages,
    localTtsVoices: settings.localTtsVoices,
    replyPlayback: settings.replyPlayback,
    assistantInstructions: settings.assistantInstructions,
    responseLength: settings.responseLength,
    responseTone: settings.responseTone,
    language,
    isRecording,
    showToast,
    t,
  });

  const isBusy = pipelinePhase !== "idle";
  const visualPhase: VoiceVisualPhase = isRecording
    ? "recording"
    : pipelinePhase === "transcribing"
      ? "transcribing"
      : player.isPlaying
        ? "speaking"
        : pipelinePhase === "synthesizing"
          ? "synthesizing"
        : pipelinePhase === "thinking"
          ? "thinking"
          : "idle";
  const isActive = visualPhase !== "idle";

  const rollbackCancelableVoiceTurn = useCallback(async () => {
    const snapshot = voiceTurnSnapshotRef.current;

    if (!snapshot || cancelableVoiceTurnSessionRef.current === null) {
      return;
    }

    voiceTurnSnapshotRef.current = null;
    cancelableVoiceTurnSessionRef.current = null;
    await restoreActiveConversationSnapshot(snapshot);
  }, [restoreActiveConversationSnapshot]);

  const cancelCurrentInteraction = useCallback(
    async ({ rollbackConversation }: { rollbackConversation: boolean }) => {
      abortRef.current?.abort();
      setPipelinePhase("idle");
      setStreamingText("");

      if (player.isPlaying) {
        await player.stopPlayback();
      }

      if (rollbackConversation) {
        await rollbackCancelableVoiceTurn();
      }
    },
    [abortRef, player, rollbackCancelableVoiceTurn, setPipelinePhase, setStreamingText],
  );

  const processCapturedVoiceTurn = useCallback(
    async (params: { audioUri?: string; transcriptionOverride?: string }) => {
      const sessionId = voiceTurnSessionRef.current + 1;
      voiceTurnSessionRef.current = sessionId;
      voiceTurnSnapshotRef.current = captureActiveConversationSnapshot();
      cancelableVoiceTurnSessionRef.current = sessionId;

      try {
        await handleVoiceCaptureDone(params);
      } finally {
        if (cancelableVoiceTurnSessionRef.current === sessionId) {
          cancelableVoiceTurnSessionRef.current = null;
        }

        if (voiceTurnSessionRef.current === sessionId) {
          voiceTurnSnapshotRef.current = null;
        }
      }
    },
    [captureActiveConversationSnapshot, handleVoiceCaptureDone],
  );

  useEffect(() => {
    if (player.isPlaying && cancelableVoiceTurnSessionRef.current !== null) {
      cancelableVoiceTurnSessionRef.current = null;
    }
  }, [player.isPlaying]);

  const handleInstallLocalTtsLanguage = useCallback(
    async (languageCode: TtsListenLanguage) => {
      try {
        const status = await installLanguagePack(languageCode);
        const languageLabel = getTtsListenLanguageLabel(languageCode, language);

        if (status?.downloaded && !status.verified) {
          showToast(status.verificationError || t("localTtsPackBroken"));
          return;
        }

        showToast(t("localTtsPackInstalled", { languageLabel }));
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : t("localTtsPackInstallFailed"),
        );
      }
    },
    [installLanguagePack, language, showToast, t],
  );

  const handleRepeatMessage = useCallback(
    async (message: { id: string; content: string }) => {
      if (activeReplayMessageId === message.id) {
        await stopReplay();
        return;
      }

      await handleRepeatLastReply(message.content, message.id);
    },
    [activeReplayMessageId, handleRepeatLastReply, stopReplay],
  );

  const resetVoiceSessionState = useCallback(async () => {
    abortRef.current?.abort();
    setPipelinePhase("idle");
    setStreamingText("");
    lastCompletedReplyRef.current = "";
    voiceTurnSnapshotRef.current = null;
    cancelableVoiceTurnSessionRef.current = null;

    if (player.isPlaying) {
      await player.stopPlayback();
    }

    if (!isRecording) {
      return;
    }

    try {
      if (settings.sttMode === "native") {
        await nativeStt.abortRecognition();
      } else {
        await recorder.stopRecording();
      }
    } catch {
      // Ignore recorder cleanup failures while switching conversations.
    }
  }, [
    abortRef,
    cancelableVoiceTurnSessionRef,
    isRecording,
    lastCompletedReplyRef,
    nativeStt,
    player,
    recorder,
    setPipelinePhase,
    setStreamingText,
    settings.sttMode,
    voiceTurnSnapshotRef,
  ]);

  const {
    handleCopyMessage,
    handleCopyThread,
    handleShareThread,
    handleShareMessage,
    handleRenameThread,
    handleTogglePinned,
    handleSelectConversation,
    handleStartNewSession,
    openMemory,
    handleCopyMemory,
    handleClearMemory,
  } = useConversationActions({
    activeConversation,
    memoryConversation,
    getConversationById,
    renameConversation,
    toggleConversationPinned,
    clearConversationMemory,
    selectConversation,
    clearActiveConversation,
    resetVoiceSessionState,
    openMemoryConversation,
    setMemoryConversation,
    showToast,
    language,
    t,
  });

  useEffect(() => {
    if (!loaded || providerApiKey) {
      return;
    }

    const fallbackMode = availableResponseModes[0];

    if (fallbackMode && fallbackMode !== activeResponseMode) {
      updateActiveResponseMode(fallbackMode);
    }
  }, [
    activeResponseMode,
    availableResponseModes,
    loaded,
    providerApiKey,
    updateActiveResponseMode,
  ]);

  useEffect(() => {
    if (!loaded || settings.sttMode !== "provider") {
      return;
    }

    const nextProvider =
      sttProvider && availableSttProviders.includes(sttProvider)
        ? sttProvider
        : (availableSttProviders[0] ?? null);

    if (nextProvider !== settings.sttProvider) {
      updateSettings({ sttProvider: nextProvider });
    }
  }, [
    availableSttProviders,
    loaded,
    settings.sttMode,
    settings.sttProvider,
    sttProvider,
    updateSettings,
  ]);

  useEffect(() => {
    if (!loaded || settings.ttsMode !== "provider") {
      return;
    }

    const nextProvider =
      ttsProvider && availableTtsProviders.includes(ttsProvider)
        ? ttsProvider
        : (availableTtsProviders[0] ?? null);

    if (nextProvider !== settings.ttsProvider) {
      updateSettings({ ttsProvider: nextProvider });
    }
  }, [
    availableTtsProviders,
    loaded,
    settings.ttsMode,
    settings.ttsProvider,
    ttsProvider,
    updateSettings,
  ]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    setSetupGuideVisible(!settings.setupGuideDismissed);
  }, [loaded, settings.setupGuideDismissed]);

  useEffect(() => {
    if (!nativeStt.lastError) {
      return;
    }

    showToast(nativeStt.lastError);
    nativeStt.clearLastError();
  }, [nativeStt.clearLastError, nativeStt.lastError, showToast]);

  useEffect(() => {
    if (!recorder.lastError) {
      return;
    }

    showToast(recorder.lastError);
    recorder.clearLastError();
  }, [recorder.clearLastError, recorder.lastError, showToast]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState !== "background") {
        return;
      }

      void (async () => {
        abortRef.current?.abort();
        setPipelinePhase("idle");
        setStreamingText("");

        try {
          if (settings.sttMode === "native") {
            await nativeStt.abortRecognition();
          } else {
            await recorder.stopRecording();
          }
        } catch {
          // Ignore background-stop failures.
        }

        await releaseLocalTtsResources();
      })();
    });

    return () => {
      subscription.remove();
      void releaseLocalTtsResources();
    };
  }, [nativeStt, recorder, settings.sttMode]);

  const ensureVoiceSessionReady = useCallback(() => {
    if (!providerApiKey) {
      showToast(t("addProviderKeyToUseProvider", { provider: providerLabel }));
      return false;
    }

    if (settings.sttMode === "native" && !nativeStt.isAvailable) {
      showToast(t("speechRecognitionUnavailableOnDevice"));
      return false;
    }

    if (
      settings.sttMode === "provider" &&
      (!sttProvider ||
        !availableSttProviders.includes(sttProvider) ||
        !sttApiKey)
    ) {
      showToast(t("chooseSttBeforeVoiceSession"));
      return false;
    }

    if (settings.ttsMode === "provider") {
      if (
        !ttsProvider ||
        !availableTtsProviders.includes(ttsProvider) ||
        !ttsApiKey
      ) {
        showToast(t("chooseTtsBeforeSpokenReplies"));
        return false;
      }
    }

    return true;
  }, [
    availableSttProviders,
    availableTtsProviders,
    providerApiKey,
    providerLabel,
    nativeStt.isAvailable,
    settings.sttMode,
    settings.ttsMode,
    t,
    showToast,
    sttApiKey,
    sttProvider,
    ttsApiKey,
    ttsProvider,
  ]);

  const handlePressIn = useCallback(async () => {
    if (player.isPlaying) {
      await cancelCurrentInteraction({ rollbackConversation: false });
      return;
    }
    if (isBusy) {
      await cancelCurrentInteraction({ rollbackConversation: true });
      return;
    }

    if (!ensureVoiceSessionReady()) {
      return;
    }

    try {
      await player.waitForPlaybackRouteSettle();

      const startPromise =
        settings.sttMode === "native"
          ? nativeStt.startRecognition()
          : recorder.startRecording();

      recordingStartedRef.current = startPromise;
      await startPromise;
    } catch (error) {
      recordingStartedRef.current = null;
      const message =
        error instanceof Error ? error.message : t("couldntStartVoiceInput");
      showToast(message);
    }
  }, [
    ensureVoiceSessionReady,
    isBusy,
    nativeStt,
    player,
    recorder,
    cancelCurrentInteraction,
    settings.sttMode,
    showToast,
    t,
  ]);

  const handlePressOut = useCallback(async () => {
    if (recordingStartedRef.current) {
      try {
        await recordingStartedRef.current;
      } catch {
        return;
      } finally {
        recordingStartedRef.current = null;
      }
    }
    try {
      if (settings.sttMode === "native") {
        const transcription = await nativeStt.stopRecognition();
        if (transcription) {
          void processCapturedVoiceTurn({ transcriptionOverride: transcription });
        }
        return;
      }

      const uri = await recorder.stopRecording();
      if (uri) {
        void processCapturedVoiceTurn({ audioUri: uri });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("couldntProcessVoiceInput");
      showToast(message);
    }
  }, [
    nativeStt,
    processCapturedVoiceTurn,
    recorder,
    settings.sttMode,
    showToast,
    t,
  ]);

  const handleTogglePress = useCallback(async () => {
    if (
      !isRecording &&
      !player.isPlaying &&
      !isBusy &&
      !ensureVoiceSessionReady()
    ) {
      return;
    }

    if (player.isPlaying) {
      await cancelCurrentInteraction({ rollbackConversation: false });
      return;
    }
    if (isBusy) {
      await cancelCurrentInteraction({ rollbackConversation: true });
      return;
    }
    if (isRecording) {
      try {
        if (settings.sttMode === "native") {
          const transcription = await nativeStt.stopRecognition();
          if (transcription) {
            void processCapturedVoiceTurn({ transcriptionOverride: transcription });
          }
          return;
        }

        const uri = await recorder.stopRecording();
        if (uri) {
          void processCapturedVoiceTurn({ audioUri: uri });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("couldntProcessVoiceInput");
        showToast(message);
      }
      return;
    }
    try {
      await player.waitForPlaybackRouteSettle();

      if (settings.sttMode === "native") {
        await nativeStt.startRecognition();
        return;
      }

      await recorder.startRecording();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("couldntStartVoiceInput");
      showToast(message);
    }
  }, [
    ensureVoiceSessionReady,
    isBusy,
    isRecording,
    nativeStt,
    player,
    processCapturedVoiceTurn,
    recorder,
    cancelCurrentInteraction,
    settings.sttMode,
    showToast,
    t,
  ]);

  const handleResponseModeChange = useCallback(
    (nextMode: ResponseMode) => {
      const nextProvider = settings.responseModes[nextMode].provider;

      if (!settings.apiKeys[nextProvider].trim()) {
        showToast(
          t("addProviderKeyToEnableProvider", {
            provider: PROVIDER_LABELS[nextProvider],
          }),
        );
        return;
      }

      updateActiveResponseMode(nextMode);
    },
    [settings.apiKeys, settings.responseModes, showToast, t, updateActiveResponseMode],
  );

  const handleDismissSetupGuide = useCallback(() => {
    setSetupGuideVisible(false);
    updateSettings({ setupGuideDismissed: true });
  }, [updateSettings]);

  const handleChooseSetupPreset = useCallback(
    (preset: "fastest" | "full-voice") => {
      if (preset === "fastest") {
        updateSettings({
          activeResponseMode: "quick",
          responseModes: {
            quick: {
              provider: "groq",
              model: "llama-3.1-8b-instant",
            },
            normal: {
              provider: "groq",
              model: "llama-3.1-8b-instant",
            },
            deep: {
              provider: "groq",
              model: "llama-3.3-70b-versatile",
            },
          },
          setupGuideDismissed: true,
          lastProvider: "groq",
          sttMode: "native",
          sttProvider: null,
          ttsMode: "native",
          ttsProvider: null,
        });
        setSetupGuideVisible(false);
        openSettings("groq");
        return;
      }

      updateSettings({
        activeResponseMode: "normal",
        responseModes: {
          quick: {
            provider: "openai",
            model: "gpt-5-mini",
          },
          normal: {
            provider: "openai",
            model: "gpt-5.4",
          },
          deep: {
            provider: "openai",
            model: "gpt-5.4",
          },
        },
        setupGuideDismissed: true,
        lastProvider: "openai",
        sttMode: "provider",
        sttProvider: "openai",
        ttsMode: "provider",
        ttsProvider: "openai",
      });
      setSetupGuideVisible(false);
      openSettings("openai");
    },
    [openSettings, updateSettings],
  );

  const handlePreviewVoice = useCallback(
    async (
      request: VoicePreviewRequest,
      callbacks?: {
        onPlaybackStarted?: () => void;
      },
    ) => {
      if (isRecording || isBusy) {
        showToast(t("stopSessionBeforePreview"));
        return;
      }

      const trimmed = request.text.trim();

      if (!trimmed) {
        return;
      }

      const previewSessionId = previewSessionRef.current + 1;
      previewSessionRef.current = previewSessionId;
      previewAbortRef.current?.abort();
      const previewAbortController = new AbortController();
      previewAbortRef.current = previewAbortController;
      const ensurePreviewActive = () => {
        if (
          previewAbortController.signal.aborted ||
          previewSessionRef.current !== previewSessionId
        ) {
          const abortError = new Error("Voice preview cancelled.");
          abortError.name = "AbortError";
          throw abortError;
        }
      };

      try {
        if (player.isPlaying) {
          await player.stopPlayback();
        }
        ensurePreviewActive();
        player.resetCancellation();
        const speechDiagnostics = {
          requestId: createSpeechRequestId("preview"),
          source: "preview" as const,
        };

        if (request.mode === "native") {
          ensurePreviewActive();
          player.speakText(trimmed, {
            voice: request.nativeVoice,
            diagnostics: speechDiagnostics,
          });
          callbacks?.onPlaybackStarted?.();
          await player.waitForDrain();
          return;
        }

        if (request.mode === "provider") {
          const providerApiKey =
            settings.apiKeys[request.provider]?.trim() ?? "";

          if (!providerApiKey) {
            showToast(t("chooseTtsToPreviewVoices"));
            return;
          }

          const audioUri = await synthesizeSpeech({
            text: trimmed,
            voice: request.voice,
            mode: "provider",
            provider: request.provider,
            providerModel:
              settings.providerTtsModels[request.provider] ||
              PROVIDER_DEFAULT_TTS_MODELS[request.provider] ||
              "",
            apiKey: providerApiKey,
            language,
            listenLanguages: [request.previewLanguage],
            diagnostics: speechDiagnostics,
            abortSignal: previewAbortController.signal,
          });

          ensurePreviewActive();
          player.enqueueAudio(audioUri, speechDiagnostics);
          callbacks?.onPlaybackStarted?.();
          await player.waitForDrain();
          return;
        }

        if (!request.voice) {
          showToast(t("chooseTtsToPreviewVoices"));
          return;
        }

        const localStatus = await getLocalTtsInstallStatus({
          language: request.localLanguage,
          voice: request.voice,
        });

        if (!localStatus.downloaded) {
          showToast(
            t("downloadSelectedLocalVoiceFirst", {
              languageLabel: getTtsListenLanguageLabel(
                request.localLanguage,
                language,
              ),
            }),
          );
          return;
        }

        const audioUri = await synthesizeSpeech({
          text: trimmed,
          voice: request.voice,
          mode: "local",
          providerModel:
            ttsProvider && settings.providerTtsModels[ttsProvider]
              ? settings.providerTtsModels[ttsProvider]
              : ttsProvider
                ? PROVIDER_DEFAULT_TTS_MODELS[ttsProvider] || ""
                : undefined,
          language,
          listenLanguages: [request.localLanguage],
          localVoices: {
            ...settings.localTtsVoices,
            [request.localLanguage]: request.voice,
          },
          diagnostics: speechDiagnostics,
          strictLocalVoice: true,
          abortSignal: previewAbortController.signal,
        });

        ensurePreviewActive();
        player.enqueueAudio(audioUri, speechDiagnostics);
        callbacks?.onPlaybackStarted?.();
        await player.waitForDrain();
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        if (request.mode === "local") {
          await refreshLocalTtsPackStates();
        }
        const message =
          error instanceof Error ? error.message : t("couldntPreviewVoice");
        showToast(message);
      } finally {
        if (previewAbortRef.current === previewAbortController) {
          previewAbortRef.current = null;
        }
      }
    },
    [
      isBusy,
      isRecording,
      player,
      settings.apiKeys,
      settings.localTtsVoices,
      settings.providerTtsModels,
      refreshLocalTtsPackStates,
      showToast,
      t,
      language,
      ttsProvider,
    ],
  );

  const stopPreviewVoice = useCallback(async () => {
    previewSessionRef.current += 1;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    await player.stopPlayback();
  }, [player]);

  const handleValidateProvider = useCallback(
    async (nextProvider: Provider) => {
      const apiKey = settings.apiKeys[nextProvider].trim();

      await validateProviderConnection({
        provider: nextProvider,
        model: getProviderValidationModel(settings, nextProvider),
        apiKey,
        language,
      });
    },
    [language, settings],
  );

  const baseMessages = activeConversation?.messages || [];
  const lastAssistantReply =
    [...baseMessages]
      .reverse()
      .find((message) => message.role === "assistant" && message.content.trim())
      ?.content.trim() || "";

  useEffect(() => {
    lastCompletedReplyRef.current = lastAssistantReply;
  }, [lastAssistantReply]);

  const messages = streamingText
    ? [
        ...baseMessages,
        {
          id: "streaming",
          role: "assistant" as const,
          content: streamingText,
          model,
          provider,
          timestamp: new Date().toISOString(),
        },
      ]
    : baseMessages;

  const messageCountLabel =
    messages.length > 0 ? t("messageCount", { count: messages.length }) : null;
  const routeModelLabel = `${responseModeLabel} · ${providerLabel} · ${modelLabel}`;
  const actionLabel =
    visualPhase === "recording"
      ? t("listening")
      : visualPhase === "transcribing"
        ? t("parsing")
        : visualPhase === "synthesizing"
          ? t("voiceOutput")
        : visualPhase === "thinking"
          ? t("thinking")
          : visualPhase === "speaking"
            ? t("speaking")
            : settings.inputMode === "push-to-talk"
              ? t("holdToSpeak")
              : t("tapToSpeak");
  const statusTitle =
    visualPhase === "recording"
      ? t("listening")
      : visualPhase === "speaking"
        ? t("speaking")
      : pipelinePhase === "synthesizing"
        ? t("voiceOutput")
        : visualPhase === "transcribing"
          ? t("parsing")
          : visualPhase === "thinking"
            ? t("thinking")
              : t("idle");
  const statusDetail =
    visualPhase === "recording"
      ? t("listeningToYourVoice")
      : visualPhase === "speaking"
        ? t("speakingBackToYou")
      : pipelinePhase === "synthesizing"
        ? t("preparingVoiceWithProvider", {
            provider: ttsProvider
              ? PROVIDER_LABELS[ttsProvider]
              : providerLabel,
          })
        : visualPhase === "transcribing"
          ? t("parsingYourVoiceInput")
          : visualPhase === "thinking"
            ? t("waitingForProvider", { provider: providerLabel })
              : (messageCountLabel ?? t("freshSession"));
  const activeConversationTitle =
    activeConversation?.title.trim() || t("untitledConversation");
  const conversationUsageTotals =
    aggregateConversationUsage(activeConversation);
  const conversationUsageByRoute =
    aggregateConversationUsageByRoute(activeConversation);
  const showConversationUsageCard =
    settings.showUsageStats && conversationUsageTotals.totalTokens > 0;
  const conversationUsageCostLabel =
    conversationUsageTotals.pricedEntryCount > 0
      ? formatUsd(conversationUsageTotals.totalCostUsd)
      : null;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "left", "right"]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />

      <LinearGradient
        colors={[
          colors.background,
          colors.backgroundSecondary,
          colors.background,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[colors.accentSoft, "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.orb, styles.orbTop]}
        />
        <LinearGradient
          colors={[`${colors.accentWarm}55`, "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.orb, styles.orbBottom]}
        />
      </View>

      <Toast
        message={toast?.message || ""}
        visible={!!toast}
        onDismiss={() => setToast(null)}
        onRetry={toast?.onRetry}
      />

      <View style={styles.defaultLayout}>
        <MainScreenTopBar
          colors={colors}
          onOpenDrawer={() => setDrawerVisible(true)}
          onOpenSettings={() => openSettings()}
        />

        <ScrollView
          style={styles.defaultScroll}
          contentContainerStyle={styles.defaultLayoutContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.glow,
              },
            ]}
          >
            <LinearGradient
              colors={[colors.accentSoft, "rgba(255,255,255,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCardGlow}
            />
            {loaded && availableResponseModes.length > 0 ? (
              <ResponseModeToggle
                selected={activeResponseMode}
                onSelect={handleResponseModeChange}
                routes={settings.responseModes}
                readyModes={availableResponseModes}
              />
            ) : (
              <TouchableOpacity
                style={[
                  styles.providerEmptyState,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => openSettings("groq")}
                activeOpacity={0.9}
              >
                <View style={styles.providerEmptyHeader}>
                  <View
                    style={[
                      styles.providerEmptyBadge,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <ProviderIcon provider="groq" color={colors.text} />
                    <Text
                      style={[
                        styles.providerEmptyBadgeText,
                        { color: colors.text },
                      ]}
                    >
                      Groq
                    </Text>
                  </View>
                  <Feather
                    name="arrow-up-right"
                    size={16}
                    color={colors.accent}
                  />
                </View>
                <Text
                  style={[styles.providerEmptyTitle, { color: colors.text }]}
                >
                  {t("startWithGroq")}
                </Text>
                <Text
                  style={[
                    styles.providerEmptyText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("groqStarterDescription")}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.stageBlock}>
            <View
              style={[styles.stageHalo, { backgroundColor: colors.glowStrong }]}
            />
            <WaveformCircle
              metering={metering}
              levels={signalLevels}
              isActive={isActive}
              phase={visualPhase}
              providerLabel={providerLabel}
              waveformVariant={signalWaveformVariant}
              inputMode={settings.inputMode}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleTogglePress}
            />
            <View
              style={[
                styles.statusStrip,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  shadowColor: colors.glow,
                },
              ]}
            >
              <View style={styles.statusStripCopy}>
                <View style={styles.statusStripLead}>
                  <View
                    style={[
                      styles.statusStripDot,
                      {
                        backgroundColor: isActive
                          ? visualPhase === "recording"
                            ? colors.danger
                            : visualPhase === "speaking"
                              ? colors.accent
                              : pipelinePhase === "synthesizing"
                                ? colors.textMuted
                                : visualPhase === "thinking" ||
                                    visualPhase === "transcribing"
                                  ? colors.textMuted
                                  : colors.success
                          : colors.accentWarm,
                      },
                    ]}
                  />
                  <Text
                    style={[styles.statusStripTitle, { color: colors.text }]}
                  >
                    {actionLabel}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.statusStripDetail,
                    { color: colors.textSecondary },
                  ]}
                >
                  {statusDetail}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.statusStripInfoButton,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
                onPress={openStatusDetails}
                activeOpacity={0.85}
              >
                <Feather name="info" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {messages.length > 0 ? (
            <View
              style={[
                styles.transcriptShell,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  shadowColor: colors.glow,
                },
              ]}
            >
              <View style={styles.transcriptHeader}>
                <TouchableOpacity
                  style={[
                    styles.expandButton,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={openTranscript}
                >
                  <Text
                    style={[styles.expandButtonText, { color: colors.text }]}
                  >
                    {t("showTranscript")}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.transcriptBody}>
                <ChatTranscript
                  messages={messages}
                  emptyTitle={t("noTranscriptYet")}
                  emptyDescription={t("previewTranscriptEmptyDescription")}
                  contentContainerStyle={styles.previewTranscriptContent}
                  scrollEnabled={false}
                  showUsageStats={settings.showUsageStats}
                  onCopyMessage={(message) => {
                    void handleCopyMessage(message.content);
                  }}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>

      <Modal
        visible={statusDetailsVisible}
        transparent
        animationType="fade"
        onRequestClose={closeStatusDetails}
      >
        <SafeAreaView style={styles.statusDetailsOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={closeStatusDetails}
            activeOpacity={1}
          />
          <View
            style={[
              styles.statusDetailsCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.glow,
              },
            ]}
          >
            <View style={styles.statusDetailsHeader}>
              <View style={styles.statusDetailsHeaderCopy}>
                <Text
                  style={[styles.statusDetailsTitle, { color: colors.text }]}
                >
                  {t("currentSetup")}
                </Text>
                <Text
                  style={[
                    styles.statusDetailsSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  {statusDetail}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.menuIconButton,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
                onPress={closeStatusDetails}
                activeOpacity={0.85}
              >
                <Feather name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.statusDetailsBadges}>
              <View
                style={[
                  styles.livePill,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.liveDot,
                    {
                      backgroundColor: isActive
                        ? colors.success
                        : colors.accentWarm,
                    },
                  ]}
                />
                <Text
                  style={[styles.livePillText, { color: colors.textSecondary }]}
                >
                  {statusTitle}
                </Text>
              </View>
              {messageCountLabel ? (
                <View
                  style={[
                    styles.statusDetailsBadge,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusDetailsBadgeText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {messageCountLabel}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.statusDetailsList}>
              <View
                style={[
                  styles.statusDetailsItem,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusDetailsItemLabel,
                    { color: colors.textMuted },
                  ]}
                >
                  {t("speechInputRoute", { route: sttStatusLabel })}
                </Text>
              </View>
              <View
                style={[
                  styles.statusDetailsItem,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusDetailsItemLabel,
                    { color: colors.textMuted },
                  ]}
                >
                  {t("replyModelRoute", { route: routeModelLabel })}
                </Text>
              </View>
              <View
                style={[
                  styles.statusDetailsItem,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusDetailsItemLabel,
                    { color: colors.textMuted },
                  ]}
                >
                  {t("voiceOutputRoute", { route: ttsStatusLabel })}
                </Text>
              </View>
              {fallbackTtsStatusLabel ? (
                <View
                  style={[
                    styles.statusDetailsItem,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusDetailsItemLabel,
                      { color: colors.textMuted },
                    ]}
                  >
                    {t("fallbackVoiceOutputRoute", {
                      route: fallbackTtsStatusLabel,
                    })}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={transcriptVisible}
        animationType="slide"
        onRequestClose={closeTranscript}
      >
        <SafeAreaView
          style={[
            styles.transcriptModal,
            { backgroundColor: colors.background },
          ]}
          edges={["left", "right", "bottom"]}
        >
          <LinearGradient
            colors={[
              colors.background,
              colors.backgroundSecondary,
              colors.background,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.expandedLayout,
              { paddingTop: Math.max(insets.top, 16) },
            ]}
          >
            <View style={styles.expandedTopBar}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("conversation")}
              </Text>
              <TouchableOpacity
                style={[
                  styles.menuIconButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={closeTranscript}
                activeOpacity={0.85}
              >
                <Feather name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.expandedStageBar}>
              <WaveformBar
                metering={metering}
                levels={signalLevels}
                isActive={isActive}
                phase={visualPhase}
                waveformVariant={signalWaveformVariant}
                inputMode={settings.inputMode}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handleTogglePress}
              />
            </View>

            <View
              style={[
                styles.expandedTranscriptDrawer,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  shadowColor: colors.glow,
                },
              ]}
            >
              <View style={styles.expandedTranscriptHeader}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.expandedTranscriptTitle,
                    { color: colors.text },
                  ]}
                >
                  {activeConversationTitle}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.menuIconButton,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={toggleConversationMenu}
                  activeOpacity={0.85}
                >
                  <Feather
                    name="more-horizontal"
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <ConversationMenu
                visible={conversationMenuVisible}
                colors={colors}
                t={t}
                onClose={closeConversationMenu}
                onManageMemory={() => {
                  closeConversationMenu();
                  void openMemory();
                }}
                onCopyThread={() => {
                  closeConversationMenu();
                  void handleCopyThread();
                }}
                onShareThread={() => {
                  closeConversationMenu();
                  void handleShareThread();
                }}
              />

              <Text
                style={[
                  styles.expandedTranscriptHint,
                  { color: colors.textSecondary },
                ]}
              >
                {t("transcriptSelectionHint")}
              </Text>

              {showConversationUsageCard ? (
                <View
                  style={[
                    styles.usageSummaryCard,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.usageSummaryHeader}>
                    <Text
                      style={[styles.usageSummaryTitle, { color: colors.text }]}
                    >
                      {t("estimatedUsageTitle")}
                    </Text>
                    <Text
                      style={[
                        styles.usageSummaryMeta,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t("estimatedUsageCounts", {
                        replies: conversationUsageTotals.replyCount,
                        summaries: conversationUsageTotals.summaryCount,
                      })}
                    </Text>
                    <Text
                      style={[
                        styles.usageSummaryNote,
                        { color: colors.textMuted },
                      ]}
                    >
                      {t("estimatedUsageConversationScope")}
                    </Text>
                  </View>
                  <View style={styles.usageSummaryRow}>
                    <Text
                      style={[
                        styles.usageSummaryMetric,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t("estimatedPromptTokens", {
                        count: formatTokenCount(
                          conversationUsageTotals.promptTokens,
                        ),
                      })}
                    </Text>
                    <Text
                      style={[
                        styles.usageSummaryMetric,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t("estimatedReplyTokens", {
                        count: formatTokenCount(
                          conversationUsageTotals.completionTokens,
                        ),
                      })}
                    </Text>
                  </View>
                  <View style={styles.usageSummaryRow}>
                    <Text
                      style={[
                        styles.usageSummaryMetricStrong,
                        { color: colors.text },
                      ]}
                    >
                      {t("estimatedTotalTokens", {
                        count: formatTokenCount(
                          conversationUsageTotals.totalTokens,
                        ),
                      })}
                    </Text>
                    {conversationUsageCostLabel ? (
                      <Text
                        style={[
                          styles.usageSummaryMetricStrong,
                          { color: colors.text },
                        ]}
                      >
                        {t(
                          conversationUsageTotals.unpricedEntryCount > 0
                            ? "estimatedCostPartial"
                            : "estimatedCost",
                          {
                            cost: conversationUsageCostLabel,
                          },
                        )}
                      </Text>
                    ) : null}
                  </View>
                  {conversationUsageByRoute.length > 1 ? (
                    <View style={styles.usageRouteList}>
                      {conversationUsageByRoute.map((route) => {
                        const routeLabel =
                          route.provider && route.model
                            ? `${PROVIDER_LABELS[route.provider]} · ${getProviderModelName(
                                route.provider,
                                route.model,
                              )}`
                            : route.model || t("unknownUsageRoute");
                        const routeCostLabel =
                          route.pricedEntryCount > 0
                            ? formatUsd(route.totalCostUsd)
                            : null;

                        return (
                          <View
                            key={`${route.provider ?? "unknown"}:${route.model ?? "unknown"}`}
                            style={styles.usageRouteRow}
                          >
                            <Text
                              style={[
                                styles.usageRouteLabel,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {routeLabel}
                            </Text>
                            <Text
                              style={[
                                styles.usageRouteValue,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {routeCostLabel
                                ? t(
                                    route.unpricedEntryCount > 0
                                      ? "estimatedRouteUsagePartial"
                                      : "estimatedRouteUsage",
                                    {
                                      tokens: formatTokenCount(
                                        route.totalTokens,
                                      ),
                                      cost: routeCostLabel,
                                    },
                                  )
                                : t("estimatedRouteUsageTokensOnly", {
                                    tokens: formatTokenCount(route.totalTokens),
                                  })}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              ) : null}

              <ChatTranscript
                messages={messages}
                emptyTitle={t("noConversationYet")}
                emptyDescription={t("expandedTranscriptEmptyDescription")}
                contentContainerStyle={styles.expandedTranscriptContent}
                showUsageStats={settings.showUsageStats}
                activeRepeatMessageId={activeReplayMessageId}
                repeatPlaybackStatus={replayPhase}
                onCopyMessage={(message) => {
                  void handleCopyMessage(message.content);
                }}
                onShareMessage={(message) => {
                  void handleShareMessage(message.content);
                }}
                onRepeatMessage={(message) => {
                  void handleRepeatMessage(message);
                }}
                messageSelectionEnabled
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <SettingsModal
        visible={settingsVisible}
        settings={settings}
        focusProvider={settingsFocusProvider}
        onUpdate={updateSettings}
        onUpdateResponseModeRoute={updateResponseModeRoute}
        onUpdateProviderSttModel={updateProviderSttModel}
        onUpdateProviderTtsModel={updateProviderTtsModel}
        onUpdateProviderTtsVoice={updateProviderTtsVoice}
        onUpdateLocalTtsVoice={updateLocalTtsVoice}
        onUpdateApiKey={updateApiKey}
        localTtsPackStates={localTtsPackStates}
        onInstallLocalTtsLanguagePack={handleInstallLocalTtsLanguage}
        onPreviewVoice={handlePreviewVoice}
        onStopPreviewVoice={stopPreviewVoice}
        onValidateProvider={handleValidateProvider}
        onClose={closeSettings}
      />
      <SetupGuideModal
        visible={setupGuideVisible}
        onChoosePreset={handleChooseSetupPreset}
        onDismiss={handleDismissSetupGuide}
      />
      <ConversationMemoryModal
        visible={memoryVisible}
        title={memoryConversation?.title ?? t("freshSession")}
        summary={memoryConversation?.contextSummary}
        summarizedMessageCount={memoryConversation?.summarizedMessageCount}
        onCopy={() => {
          void handleCopyMemory();
        }}
        onClear={() => {
          void handleClearMemory();
        }}
        onClose={closeMemory}
      />
      <ConversationDrawer
        visible={drawerVisible}
        conversations={conversations}
        activeId={activeConversation?.id || null}
        onSearchConversations={searchConversations}
        onSelect={handleSelectConversation}
        onCopyThread={(id) => {
          void handleCopyThread(id);
        }}
        onShareThread={(id) => {
          runAfterDrawerDismiss(() => {
            void handleShareThread(id);
          });
        }}
        onManageMemory={(id) => {
          runAfterDrawerDismiss(() => {
            void openMemory(id);
          });
        }}
        onRenameThread={(id, title) => {
          void handleRenameThread(id, title);
        }}
        onTogglePinned={handleTogglePinned}
        onNewSession={handleStartNewSession}
        onDelete={deleteConversation}
        onClose={() => setDrawerVisible(false)}
        onDismiss={handleDrawerDismiss}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  orb: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.8,
  },
  orbTop: {
    top: -60,
    right: -90,
  },
  orbBottom: {
    bottom: 90,
    left: -80,
  },
  defaultLayout: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  defaultScroll: {
    flex: 1,
  },
  defaultLayoutContent: {
    paddingBottom: 28,
  },
  expandedLayout: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 10,
    marginBottom: 28,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.12,
    shadowRadius: 34,
    elevation: 10,
  },
  heroCardGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  providerEmptyState: {
    borderRadius: 22,
    borderWidth: 1,
    minHeight: 96,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: "center",
    gap: 6,
  },
  providerEmptyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  providerEmptyBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  providerEmptyBadgeText: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  providerEmptyTitle: {
    fontSize: 14,
    fontFamily: fonts.display,
  },
  providerEmptyText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  livePillText: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  stageBlock: {
    width: "100%",
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 22,
  },
  stageHalo: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.18,
  },
  statusStrip: {
    width: "100%",
    maxWidth: 360,
    marginTop: 36,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 8,
  },
  statusStripCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  statusStripLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusStripDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusStripTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.display,
  },
  statusStripDetail: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  statusStripInfoButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  transcriptShell: {
    height: 288,
    borderRadius: 32,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
    paddingTop: 14,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 8,
  },
  expandedTranscriptDrawer: {
    flex: 1,
    borderRadius: 32,
    borderWidth: 1,
    position: "relative",
    paddingTop: 10,
    paddingHorizontal: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 8,
  },
  transcriptHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  transcriptBody: {
    flex: 1,
    minHeight: 0,
  },
  menuIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  expandButtonText: {
    fontSize: 13,
    fontFamily: fonts.display,
  },
  previewTranscriptContent: {
    paddingTop: 4,
    paddingHorizontal: 16,
    paddingBottom: 26,
  },
  expandedTranscriptContent: {
    paddingBottom: 38,
  },
  expandedStageBar: {
    width: "100%",
    marginBottom: 12,
    zIndex: 1,
  },
  transcriptModal: {
    flex: 1,
  },
  statusDetailsOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.16)",
  },
  statusDetailsCard: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 12,
  },
  statusDetailsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  statusDetailsHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  statusDetailsTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontFamily: fonts.display,
  },
  statusDetailsSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.body,
  },
  statusDetailsBadges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  statusDetailsBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusDetailsBadgeText: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  statusDetailsList: {
    gap: 10,
  },
  statusDetailsItem: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusDetailsItemLabel: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.body,
  },
  expandedTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  modalTitle: {
    flex: 1,
    fontSize: 24,
    lineHeight: 28,
    fontFamily: fonts.display,
  },
  expandedTranscriptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  expandedTranscriptTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fonts.display,
  },
  expandedTranscriptHint: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
    fontFamily: fonts.body,
  },
  usageSummaryCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 8,
  },
  usageSummaryHeader: {
    gap: 4,
  },
  usageSummaryTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.display,
  },
  usageSummaryMeta: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.mono,
  },
  usageSummaryNote: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.body,
  },
  usageSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  usageRouteList: {
    marginTop: 4,
    gap: 8,
  },
  usageRouteRow: {
    gap: 2,
  },
  usageRouteLabel: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.display,
  },
  usageRouteValue: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.mono,
  },
  usageSummaryMetric: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.mono,
  },
  usageSummaryMetricStrong: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.mono,
  },
});
