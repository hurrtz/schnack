import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatTranscript } from "../components/ChatTranscript";
import { ConversationMemoryModal } from "../components/ConversationMemoryModal";
import { ConversationDrawer } from "../components/ConversationDrawer";
import { ProviderToggle } from "../components/ProviderToggle";
import { SettingsModal } from "../components/SettingsModal";
import { SetupGuideModal } from "../components/SetupGuideModal";
import { Toast } from "../components/Toast";
import { ProviderIcon } from "../components/ProviderIcon";
import { WaveformBar } from "../components/WaveformBar";
import { WaveformCircle } from "../components/WaveformCircle";
import {
  getTtsVoiceLabel,
  PROVIDER_DEFAULT_TTS_VOICES,
  PROVIDER_LABELS,
} from "../constants/models";
import { useSharedSettings } from "../context/SettingsContext";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useNativeSpeechRecognizer } from "../hooks/useNativeSpeechRecognizer";
import { useConversations } from "../hooks/useConversations";
import { useLocalization } from "../i18n";
import { validateProviderConnection } from "../services/llm";
import { runVoicePipeline } from "../services/voicePipeline";
import {
  synthesizeSpeech,
  synthesizeSpeechSequence,
  TtsRequestError,
} from "../services/tts";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Conversation, Provider, VoiceVisualPhase } from "../types";
import {
  formatConversationForCopy,
} from "../utils/conversationExport";
import {
  getEnabledProviders,
  getEnabledSttProviders,
  getEnabledTtsProviders,
} from "../utils/providerCapabilities";

export function MainScreen() {
  const { colors, isDark } = useTheme();
  const { t, language } = useLocalization();
  const insets = useSafeAreaInsets();
  const {
    settings,
    updateSettings,
    updateProviderModel,
    updateProviderTtsVoice,
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
  } = useConversations();

  const recorder = useAudioRecorder();
  const nativeStt = useNativeSpeechRecognizer();
  const player = useAudioPlayer();

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsFocusProvider, setSettingsFocusProvider] = useState<Provider | undefined>();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [transcriptVisible, setTranscriptVisible] = useState(false);
  const [conversationMenuVisible, setConversationMenuVisible] = useState(false);
  const [setupGuideVisible, setSetupGuideVisible] = useState(false);
  const [memoryConversation, setMemoryConversation] = useState<Conversation | null>(
    null
  );
  const [memoryVisible, setMemoryVisible] = useState(false);
  const [pipelinePhase, setPipelinePhase] = useState<
    "idle" | "transcribing" | "thinking"
  >("idle");
  const [streamingText, setStreamingText] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    onRetry?: () => void;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const recordingStartedRef = useRef<Promise<void> | null>(null);
  const lastCompletedReplyRef = useRef("");
  const ttsFallbackToastShownRef = useRef(false);

  const provider = settings.lastProvider;
  const providerApiKey = settings.apiKeys[provider].trim();
  const model = settings.providerModels[provider];
  const availableProviders = getEnabledProviders(settings);
  const availableSttProviders = getEnabledSttProviders(settings);
  const availableTtsProviders = getEnabledTtsProviders(settings);
  const sttProvider = settings.sttMode === "provider" ? settings.sttProvider : null;
  const ttsProvider = settings.ttsMode === "provider" ? settings.ttsProvider : null;
  const sttApiKey = sttProvider ? settings.apiKeys[sttProvider].trim() : "";
  const ttsApiKey = ttsProvider ? settings.apiKeys[ttsProvider].trim() : "";
  const sttStatusLabel =
    settings.sttMode === "native"
      ? t("appNative")
      : sttProvider
        ? PROVIDER_LABELS[sttProvider]
        : t("noProviderYet");
  const selectedTtsVoice = ttsProvider
    ? settings.providerTtsVoices[ttsProvider] ||
      PROVIDER_DEFAULT_TTS_VOICES[ttsProvider] ||
      ""
    : "";
  const providerLabel = PROVIDER_LABELS[provider];
  const isBusy = pipelinePhase !== "idle";
  const isRecording =
    settings.sttMode === "native" ? nativeStt.isRecording : recorder.isRecording;
  const recordingMetering =
    settings.sttMode === "native" ? nativeStt.meteringData : recorder.meteringData;
  const recordingLevels =
    settings.sttMode === "native" ? nativeStt.waveformData : recorder.waveformData;
  const ttsStatusLabel =
    settings.ttsMode === "native"
      ? t("systemVoice")
      : ttsProvider
        ? `${PROVIDER_LABELS[ttsProvider]} · ${getTtsVoiceLabel(
            ttsProvider,
            selectedTtsVoice,
            language
          )}`
        : t("noTtsProvider");
  const visualPhase: VoiceVisualPhase = isRecording
    ? "recording"
    : pipelinePhase === "transcribing"
      ? "transcribing"
      : player.isPlaying
        ? "speaking"
        : pipelinePhase === "thinking"
          ? "thinking"
          : "idle";
  const isActive = visualPhase !== "idle";
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

  const showToast = useCallback(
    (message: string, onRetry?: () => void) => {
      setToast({ message, onRetry });
    },
    []
  );

  const copyText = useCallback(
    async (text: string, successMessage: string) => {
      if (!text.trim()) {
        showToast(t("nothingToCopyYet"));
        return;
      }

      try {
        await Clipboard.setStringAsync(text);
        showToast(successMessage);
      } catch {
        showToast(t("couldntCopyText"));
      }
    },
    [showToast, t]
  );

  const handleCopyMessage = useCallback(
    async (content: string) => {
      await copyText(content.trim(), t("messageCopied"));
    },
    [copyText, t]
  );

  const handleCopyThread = useCallback(
    async (conversationId?: string) => {
      const conversation = conversationId
        ? await getConversationById(conversationId)
        : activeConversation;

      if (!conversation || conversation.messages.length === 0) {
        showToast(t("noConversationToCopyYet"));
        return;
      }

      await copyText(
        formatConversationForCopy(conversation, language),
        t("threadCopied")
      );
    },
    [activeConversation, copyText, getConversationById, language, showToast, t]
  );

  const handleShareThread = useCallback(
    async (conversationId?: string) => {
      const conversation = conversationId
        ? await getConversationById(conversationId)
        : activeConversation;

      if (!conversation || conversation.messages.length === 0) {
        showToast(t("noConversationToShareYet"));
        return;
      }

      const title = conversation.title.trim() || t("untitledConversation");
      const message = formatConversationForCopy(conversation, language);

      try {
        await Share.share(
          {
            title,
            message,
          },
          {
            dialogTitle: title,
          }
        );
      } catch {
        showToast(t("couldntShareText"));
      }
    },
    [activeConversation, getConversationById, language, showToast, t]
  );

  const handleShareMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();

      if (!trimmed) {
        showToast(t("nothingToShareYet"));
        return;
      }

      try {
        await Share.share({ message: trimmed });
      } catch {
        showToast(t("couldntShareText"));
      }
    },
    [showToast, t]
  );

  const handleRenameThread = useCallback(
    async (conversationId: string, nextTitle: string) => {
      await renameConversation(conversationId, nextTitle);
      showToast(t("threadRenamed"));
    },
    [renameConversation, showToast, t]
  );

  const handleTogglePinned = useCallback(
    (conversationId: string) => {
      const pinned = toggleConversationPinned(conversationId);
      showToast(pinned ? t("threadPinned") : t("threadUnpinned"));
    },
    [showToast, t, toggleConversationPinned]
  );

  const playReplyText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();

      if (!trimmed) {
        return;
      }

      if (player.isPlaying) {
        await player.stopPlayback();
      }

      player.resetCancellation();

      if (settings.ttsMode === "native") {
        player.speakText(trimmed);
        return;
      }

      if (!ttsProvider || !ttsApiKey) {
        showToast(t("chooseTtsBeforeSpokenReplies"));
        return;
      }

      const audioUris = await synthesizeSpeechSequence({
        text: trimmed,
        voice: selectedTtsVoice,
        mode: settings.ttsMode,
        provider: ttsProvider,
        apiKey: ttsApiKey,
        language,
      }).catch(async (error) => {
        if (!(error instanceof TtsRequestError)) {
          throw error;
        }

        player.speakText(trimmed);
        showToast(t("providerVoiceFallback"));
        return null;
      });

      if (!audioUris) {
        return;
      }

      audioUris.forEach((audioUri) => {
        player.enqueueAudio(audioUri);
      });
    },
    [
      player,
      settings.ttsMode,
      selectedTtsVoice,
      showToast,
      t,
      ttsApiKey,
      language,
      ttsProvider,
    ]
  );

  const handleRepeatLastReply = useCallback(
    async (textOverride?: string) => {
      const replyText =
        textOverride?.trim() ||
        lastCompletedReplyRef.current.trim();

      if (!replyText) {
        showToast(t("noReplyToRepeatYet"));
        return;
      }

      if (isRecording || isBusy) {
        showToast(t("stopSessionBeforeReplay"));
        return;
      }

      try {
        await playReplyText(replyText);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("couldntReplayReply");
        showToast(message);
      }
    },
    [isBusy, isRecording, playReplyText, showToast, t]
  );

  const openSettings = useCallback((focusProvider?: Provider) => {
    setSettingsFocusProvider(focusProvider);
    setSettingsVisible(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsVisible(false);
    setSettingsFocusProvider(undefined);
  }, []);

  useEffect(() => {
    if (!loaded || providerApiKey) {
      return;
    }

    const fallbackProvider = availableProviders[0];

    if (fallbackProvider && fallbackProvider !== provider) {
      updateSettings({ lastProvider: fallbackProvider });
    }
  }, [availableProviders, loaded, provider, providerApiKey, updateSettings]);

  useEffect(() => {
    if (!loaded || settings.sttMode !== "provider") {
      return;
    }

    const nextProvider =
      sttProvider && availableSttProviders.includes(sttProvider)
        ? sttProvider
        : availableSttProviders[0] ?? null;

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
        : availableTtsProviders[0] ?? null;

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

  const ensureVoiceSessionReady = useCallback(() => {
    if (!providerApiKey) {
      showToast(
        t("addProviderKeyToUseProvider", { provider: providerLabel })
      );
      return false;
    }

    if (settings.sttMode === "native" && !nativeStt.isAvailable) {
      showToast(t("speechRecognitionUnavailableOnDevice"));
      return false;
    }

    if (
      settings.sttMode === "provider" &&
      (!sttProvider || !availableSttProviders.includes(sttProvider) || !sttApiKey)
    ) {
      showToast(t("chooseSttBeforeVoiceSession"));
      return false;
    }

    if (settings.ttsMode === "provider") {
      if (!ttsProvider || !availableTtsProviders.includes(ttsProvider) || !ttsApiKey) {
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

  const handleVoiceCaptureDone = useCallback(
    async ({
      audioUri,
      transcriptionOverride,
    }: {
      audioUri?: string;
      transcriptionOverride?: string;
    }) => {
      setPipelinePhase(transcriptionOverride ? "thinking" : "transcribing");
      setStreamingText("");
      ttsFallbackToastShownRef.current = false;
      abortRef.current = new AbortController();
      player.resetCancellation();

      try {
        const transcription = await runVoicePipeline({
          audioUri,
          transcriptionOverride,
          messages: activeConversation?.messages || [],
          contextSummary: activeConversation?.contextSummary,
          summarizedMessageCount: activeConversation?.summarizedMessageCount,
          model,
          provider,
          providerApiKey,
          sttMode: settings.sttMode,
          sttProvider,
          sttApiKey,
          ttsMode: settings.ttsMode,
          ttsProvider,
          ttsApiKey,
          ttsVoice: selectedTtsVoice,
          replyPlayback: settings.replyPlayback,
          assistantInstructions: settings.assistantInstructions,
          responseLength: settings.responseLength,
          responseTone: settings.responseTone,
          language,
          abortSignal: abortRef.current!.signal,
          callbacks: {
            onTranscription: (text) => {
              setPipelinePhase("thinking");
              if (!activeConversation) {
                createConversation(text, model, provider);
              }
              setTimeout(() => {
                addMessage({
                  role: "user",
                  content: text,
                  model: null,
                  provider: null,
                });
              }, 0);
            },
            onContextSummary: (summary, summarizedCount) => {
              updateConversationContextSummary(summary, summarizedCount);
            },
            onChunk: (text) => {
              setPipelinePhase("thinking");
              setStreamingText((prev) => prev + text);
            },
            onResponseDone: (fullText) => {
              setStreamingText("");
              lastCompletedReplyRef.current = fullText;
              addMessage({
                role: "assistant",
                content: fullText,
                model,
                provider,
              });
            },
            onAudioReady: (audioData) => {
              player.enqueueAudio(audioData);
            },
            onSpeechTextReady: (text) => {
              player.speakText(text);
            },
            onTtsFallback: () => {
              if (ttsFallbackToastShownRef.current) {
                return;
              }

              ttsFallbackToastShownRef.current = true;
              showToast(t("providerVoiceFallback"));
            },
            onError: (error) => {
              setPipelinePhase("idle");
              const retryAction =
                error instanceof TtsRequestError &&
                lastCompletedReplyRef.current.trim()
                  ? () => {
                      void handleRepeatLastReply(lastCompletedReplyRef.current);
                    }
                  : () => {
                      void handleVoiceCaptureDone({
                        audioUri,
                        transcriptionOverride,
                      });
                    };

              showToast(error.message, retryAction);
            },
          },
        });

        if (!transcription) {
          showToast(t("couldntCatchThatTryAgain"));
        }
      } catch {
        // Errors are surfaced through the toast callback above.
      } finally {
        setPipelinePhase("idle");
      }
    },
    [
      activeConversation,
      addMessage,
      createConversation,
      model,
      player,
      provider,
      providerApiKey,
      settings.replyPlayback,
      selectedTtsVoice,
      settings.sttMode,
      settings.ttsMode,
      settings.assistantInstructions,
      settings.responseLength,
      settings.responseTone,
      language,
      handleRepeatLastReply,
      showToast,
      sttApiKey,
      sttProvider,
      t,
      ttsApiKey,
      ttsProvider,
      updateConversationContextSummary,
    ]
  );

  const handlePressIn = useCallback(async () => {
    if (!ensureVoiceSessionReady()) {
      return;
    }

    if (player.isPlaying) {
      await player.stopPlayback();
      abortRef.current?.abort();
      setPipelinePhase("idle");
      setStreamingText("");
    }
    if (isBusy) {
      abortRef.current?.abort();
      setPipelinePhase("idle");
      setStreamingText("");
    }
    try {
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
          handleVoiceCaptureDone({ transcriptionOverride: transcription });
        }
        return;
      }

      const uri = await recorder.stopRecording();
      if (uri) {
        handleVoiceCaptureDone({ audioUri: uri });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("couldntProcessVoiceInput");
      showToast(message);
    }
  }, [handleVoiceCaptureDone, nativeStt, recorder, settings.sttMode, showToast, t]);

  const handleTogglePress = useCallback(async () => {
    if (!isRecording && !player.isPlaying && !isBusy && !ensureVoiceSessionReady()) {
      return;
    }

    if (player.isPlaying) {
      await player.stopPlayback();
      abortRef.current?.abort();
      setPipelinePhase("idle");
      setStreamingText("");
      return;
    }
    if (isBusy) {
      abortRef.current?.abort();
      setPipelinePhase("idle");
      setStreamingText("");
      return;
    }
    if (isRecording) {
      try {
        if (settings.sttMode === "native") {
          const transcription = await nativeStt.stopRecognition();
          if (transcription) {
            handleVoiceCaptureDone({ transcriptionOverride: transcription });
          }
          return;
        }

        const uri = await recorder.stopRecording();
        if (uri) {
          handleVoiceCaptureDone({ audioUri: uri });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("couldntProcessVoiceInput");
        showToast(message);
      }
      return;
    }
    try {
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
    handleVoiceCaptureDone,
    isBusy,
    isRecording,
    nativeStt,
    player,
    recorder,
    settings.sttMode,
    showToast,
    t,
  ]);

  const handleProviderChange = useCallback(
    (nextProvider: Provider) => {
      if (!settings.apiKeys[nextProvider].trim()) {
        showToast(
          t("addProviderKeyToEnableProvider", {
            provider: PROVIDER_LABELS[nextProvider],
          })
        );
        return;
      }

      updateSettings({ lastProvider: nextProvider });
    },
    [settings.apiKeys, showToast, t, updateSettings]
  );

  const handleDismissSetupGuide = useCallback(() => {
    setSetupGuideVisible(false);
    updateSettings({ setupGuideDismissed: true });
  }, [updateSettings]);

  const handleChooseSetupPreset = useCallback(
    (preset: "fastest" | "full-voice") => {
      if (preset === "fastest") {
        updateSettings({
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
    [openSettings, updateSettings]
  );

  const handlePreviewVoice = useCallback(
    async (text: string) => {
      if (isRecording || isBusy) {
        showToast(t("stopSessionBeforePreview"));
        return;
      }

      try {
        if (player.isPlaying) {
          await player.stopPlayback();
        }
        player.resetCancellation();
        if (settings.ttsMode === "native") {
          player.speakText(text);
          return;
        }

        if (!ttsProvider || !ttsApiKey) {
          showToast(t("chooseTtsToPreviewVoices"));
          return;
        }

        const audioUri = await synthesizeSpeech({
          text,
          voice: selectedTtsVoice,
          mode: settings.ttsMode,
          provider: ttsProvider,
          apiKey: ttsApiKey,
          language,
        }).catch((error) => {
          if (!(error instanceof TtsRequestError)) {
            throw error;
          }

          player.speakText(text);
          showToast(t("providerVoicePreviewFallback"));
          return null;
        });

        if (!audioUri) {
          return;
        }

        player.enqueueAudio(audioUri);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("couldntPreviewVoice");
        showToast(message);
      }
    },
    [
      isBusy,
      isRecording,
      player,
      settings.ttsMode,
      selectedTtsVoice,
      showToast,
      t,
      ttsApiKey,
      language,
      ttsProvider,
    ]
  );

  const handleValidateProvider = useCallback(
    async (nextProvider: Provider) => {
      const apiKey = settings.apiKeys[nextProvider].trim();

      await validateProviderConnection({
        provider: nextProvider,
        model: settings.providerModels[nextProvider],
        apiKey,
        language,
      });
    },
    [language, settings.apiKeys, settings.providerModels]
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

  const sessionMeta = activeConversation
    ? `${t("messageCount", { count: messages.length })} · ${providerLabel} · ${model}`
    : `${providerLabel} · ${model}`;
  const routeModelLabel = `${providerLabel} · ${model}`;

  const openMemory = useCallback(
    async (conversationId?: string) => {
      const conversation = conversationId
        ? await getConversationById(conversationId)
        : activeConversation;

      if (!conversation) {
        showToast(t("noConversationToManageYet"));
        return;
      }

      setMemoryConversation(conversation);
      setMemoryVisible(true);
    },
    [activeConversation, getConversationById, showToast, t]
  );

  const closeMemory = useCallback(() => {
    setMemoryVisible(false);
    setMemoryConversation(null);
  }, []);

  const handleCopyMemory = useCallback(async () => {
    const summary = memoryConversation?.contextSummary?.trim() ?? "";

    if (!summary) {
      showToast(t("noConversationToManageYet"));
      return;
    }

    await copyText(summary, t("memoryCopied"));
  }, [copyText, memoryConversation?.contextSummary, showToast, t]);

  const handleClearMemory = useCallback(async () => {
    if (!memoryConversation) {
      return;
    }

    const updatedConversation = await clearConversationMemory(memoryConversation.id);

    setMemoryConversation(updatedConversation);
    showToast(t("memoryCleared"));
  }, [clearConversationMemory, memoryConversation, showToast, t]);

  const openTranscript = useCallback(() => {
    setConversationMenuVisible(false);
    setTranscriptVisible(true);
  }, []);

  const closeTranscript = useCallback(() => {
    setConversationMenuVisible(false);
    setTranscriptVisible(false);
  }, []);

  const closeConversationMenu = useCallback(() => {
    setConversationMenuVisible(false);
  }, []);

  const toggleConversationMenu = useCallback(() => {
    setConversationMenuVisible((previous) => !previous);
  }, []);

  const renderTopBar = (compact = false) => (
    <View style={styles.topBar}>
      <TouchableOpacity
        style={[
          styles.iconButton,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.glow,
          },
        ]}
        onPress={() => setDrawerVisible(true)}
      >
        <Feather name="menu" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      {compact ? (
        <View
          style={[
            styles.compactBrand,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.compactBrandText, { color: colors.text }]}>
            SchnackAI
          </Text>
        </View>
      ) : (
        <View style={styles.wordmark}>
          <Text style={[styles.wordmarkText, { color: colors.text }]}>
            SchnackAI
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.iconButton,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.glow,
          },
        ]}
        onPress={() => openSettings()}
      >
        <Feather name="settings" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  const renderConversationMenu = (variant: "preview" | "modal") =>
    conversationMenuVisible ? (
      <>
        <TouchableOpacity
          style={styles.conversationMenuBackdrop}
          onPress={closeConversationMenu}
          activeOpacity={1}
        />
        <View
          style={[
            styles.conversationMenu,
            variant === "modal"
              ? styles.conversationMenuModal
              : styles.conversationMenuPreview,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.glow,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.conversationMenuItem}
            onPress={() => {
              closeConversationMenu();
              void openMemory();
            }}
            activeOpacity={0.85}
          >
            <Feather name="archive" size={15} color={colors.accent} />
            <Text style={[styles.conversationMenuText, { color: colors.text }]}>
              {t("memory")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.conversationMenuItem}
            onPress={() => {
              closeConversationMenu();
              void handleCopyThread();
            }}
            activeOpacity={0.85}
          >
            <Feather name="copy" size={15} color={colors.accent} />
            <Text style={[styles.conversationMenuText, { color: colors.text }]}>
              {t("copyThread")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.conversationMenuItem}
            onPress={() => {
              closeConversationMenu();
              void handleShareThread();
            }}
            activeOpacity={0.85}
          >
            <Feather name="share" size={15} color={colors.accent} />
            <Text style={[styles.conversationMenuText, { color: colors.text }]}>
              {t("shareThread")}
            </Text>
          </TouchableOpacity>
        </View>
      </>
    ) : null;

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
        {renderTopBar(false)}

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
            {loaded && availableProviders.length > 0 ? (
              <ProviderToggle
                selected={provider}
                onSelect={handleProviderChange}
                visibleProviders={availableProviders}
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
                    <ProviderIcon
                      provider="groq"
                      color={colors.text}
                    />
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
                <Text style={[styles.providerEmptyTitle, { color: colors.text }]}>
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
              style={[
                styles.stageHalo,
                { backgroundColor: colors.glowStrong },
              ]}
            />
            <WaveformCircle
              metering={metering}
              levels={signalLevels}
              isActive={isActive}
              phase={visualPhase}
              providerLabel={providerLabel}
              inputMode={settings.inputMode}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleTogglePress}
            />
            <View
              style={[
                styles.statusCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  shadowColor: colors.glow,
                },
              ]}
            >
              <View style={styles.statusCardHeader}>
                <View style={styles.statusHeaderCopy}>
                  <Text style={[styles.statusTitle, { color: colors.text }]}>
                    {t("controlRoom")}
                  </Text>
                </View>
                <View
                  style={[
                    styles.livePill,
                    styles.controlRoomPill,
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
                    style={[
                      styles.livePillText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {isActive ? t("live") : t("idle")}
                  </Text>
                </View>
              </View>
              <View style={styles.statusMetaRow}>
                <Text style={[styles.statusMeta, { color: colors.textMuted }]}>
                  {sessionMeta}
                </Text>
                <Text style={[styles.statusMeta, { color: colors.textMuted }]}>
                  {ttsStatusLabel}
                </Text>
              </View>
              <View style={styles.statusRouteList}>
                <Text style={[styles.statusRouteText, { color: colors.textMuted }]}>
                  {t("speechInputRoute", { route: sttStatusLabel })}
                </Text>
                <Text style={[styles.statusRouteText, { color: colors.textMuted }]}>
                  {t("replyModelRoute", { route: routeModelLabel })}
                </Text>
                <Text style={[styles.statusRouteText, { color: colors.textMuted }]}>
                  {t("voiceOutputRoute", { route: ttsStatusLabel })}
                </Text>
              </View>
            </View>
          </View>

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
            {renderConversationMenu("preview")}

            <View style={styles.transcriptHeader}>
              <View style={styles.transcriptHeaderCopy}>
                <Text style={[styles.transcriptTitle, { color: colors.text }]}>
                  {t("conversation")}
                </Text>
              </View>
              <View style={styles.transcriptTopActions}>
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
                    {t("show")}
                  </Text>
                  <Feather
                    name="arrow-up-right"
                    size={15}
                    color={colors.accent}
                  />
                </TouchableOpacity>
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
            </View>

            <ChatTranscript
              messages={messages}
              emptyTitle={t("noTranscriptYet")}
              emptyDescription={t("previewTranscriptEmptyDescription")}
              contentContainerStyle={styles.previewTranscriptContent}
              scrollEnabled={false}
              onCopyMessage={(message) => {
                void handleCopyMessage(message.content);
              }}
            />
          </View>
        </ScrollView>
      </View>

      <Modal
        visible={transcriptVisible}
        animationType="slide"
        onRequestClose={closeTranscript}
      >
        <SafeAreaView
          style={[styles.transcriptModal, { backgroundColor: colors.background }]}
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
              {renderConversationMenu("modal")}

              <Text
                style={[
                  styles.expandedTranscriptHint,
                  { color: colors.textSecondary },
                ]}
              >
                {t("transcriptSelectionHint")}
              </Text>

              <ChatTranscript
                messages={messages}
                emptyTitle={t("noConversationYet")}
                emptyDescription={t("expandedTranscriptEmptyDescription")}
                contentContainerStyle={styles.expandedTranscriptContent}
                onCopyMessage={(message) => {
                  void handleCopyMessage(message.content);
                }}
                onShareMessage={(message) => {
                  void handleShareMessage(message.content);
                }}
                onRepeatMessage={(message) => {
                  void handleRepeatLastReply(message.content);
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
        onUpdateProviderModel={updateProviderModel}
        onUpdateProviderTtsVoice={updateProviderTtsVoice}
        onUpdateApiKey={updateApiKey}
        onPreviewVoice={handlePreviewVoice}
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
        onSelect={selectConversation}
        onCopyThread={(id) => {
          void handleCopyThread(id);
        }}
        onShareThread={(id) => {
          void handleShareThread(id);
        }}
        onManageMemory={(id) => {
          void openMemory(id);
        }}
        onRenameThread={(id, title) => {
          void handleRenameThread(id, title);
        }}
        onTogglePinned={handleTogglePinned}
        onNewSession={clearActiveConversation}
        onDelete={deleteConversation}
        onClose={() => setDrawerVisible(false)}
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 14,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  wordmark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  wordmarkText: {
    fontSize: 24,
    letterSpacing: 0.8,
    fontFamily: fonts.displayHeavy,
  },
  compactBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  compactBrandText: {
    fontSize: 14,
    letterSpacing: 0.6,
    fontFamily: fonts.displayHeavy,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
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
  controlRoomPill: {
    marginLeft: "auto",
  },
  stageBlock: {
    width: "100%",
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 18,
  },
  stageHalo: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.18,
  },
  statusCard: {
    width: "100%",
    maxWidth: 360,
    marginTop: 18,
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 8,
  },
  statusCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 2,
  },
  statusHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  statusTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontFamily: fonts.display,
  },
  statusMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
  },
  statusMeta: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  statusRouteList: {
    marginTop: 12,
    gap: 6,
  },
  statusRouteText: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.body,
  },
  transcriptShell: {
    height: 288,
    borderRadius: 32,
    borderWidth: 1,
    position: "relative",
    paddingTop: 18,
    paddingHorizontal: 16,
    overflow: "hidden",
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
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  transcriptHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  transcriptTopActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: -2,
  },
  transcriptTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontFamily: fonts.display,
  },
  menuIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  conversationMenu: {
    position: "absolute",
    right: 16,
    width: 196,
    borderRadius: 22,
    borderWidth: 1,
    padding: 8,
    gap: 2,
    zIndex: 5,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 10,
  },
  conversationMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  conversationMenuPreview: {
    top: 62,
  },
  conversationMenuModal: {
    top: 52,
  },
  conversationMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 16,
  },
  conversationMenuText: {
    fontSize: 14,
    fontFamily: fonts.body,
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
    justifyContent: "flex-end",
    gap: 12,
    marginBottom: 10,
  },
  expandedTranscriptHint: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
    fontFamily: fonts.body,
  },
});
