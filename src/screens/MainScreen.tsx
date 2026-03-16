import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChatTranscript } from "../components/ChatTranscript";
import { ConversationDrawer } from "../components/ConversationDrawer";
import { ProviderToggle } from "../components/ProviderToggle";
import { SettingsModal } from "../components/SettingsModal";
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
import { runVoicePipeline } from "../services/voicePipeline";
import { synthesizeSpeech } from "../services/tts";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Provider, VoiceVisualPhase } from "../types";
import {
  formatConversationForCopy,
} from "../utils/conversationExport";
import {
  getEnabledProviders,
  getEnabledSttProviders,
  getEnabledTtsProviders,
} from "../utils/providerCapabilities";

type ViewMode = "default" | "expanded";

export function MainScreen() {
  const { colors, isDark } = useTheme();
  const { t, language } = useLocalization();
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
    deleteConversation,
    clearActiveConversation,
  } = useConversations();

  const recorder = useAudioRecorder();
  const nativeStt = useNativeSpeechRecognizer();
  const player = useAudioPlayer();

  const [viewMode, setViewMode] = useState<ViewMode>("default");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsFocusProvider, setSettingsFocusProvider] = useState<Provider | undefined>();
  const [drawerVisible, setDrawerVisible] = useState(false);
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
  const expandedDrawerTranslateY = useRef(new Animated.Value(0)).current;

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

  const resetExpandedDrawer = useCallback(() => {
    Animated.spring(expandedDrawerTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 18,
    }).start();
  }, [expandedDrawerTranslateY]);

  const collapseExpandedDrawer = useCallback(() => {
    Animated.timing(expandedDrawerTranslateY, {
      toValue: 220,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      expandedDrawerTranslateY.setValue(0);
      setViewMode("default");
    });
  }, [expandedDrawerTranslateY]);

  const expandedDrawerPanResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
    onPanResponderMove: (_, gestureState) => {
      expandedDrawerTranslateY.setValue(Math.max(0, gestureState.dy));
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 86 || gestureState.vy > 1.1) {
        collapseExpandedDrawer();
        return;
      }

      resetExpandedDrawer();
    },
    onPanResponderTerminate: resetExpandedDrawer,
  });

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
    if (viewMode === "expanded") {
      expandedDrawerTranslateY.setValue(0);
    }
  }, [expandedDrawerTranslateY, viewMode]);

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
            onError: (error) => {
              setPipelinePhase("idle");
              showToast(error.message, () =>
                handleVoiceCaptureDone({ audioUri, transcriptionOverride })
              );
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
        });
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

  const baseMessages = activeConversation?.messages || [];
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

  const statusEyebrow = isRecording
      ? t("liveInput")
      : pipelinePhase === "transcribing"
        ? t("parsingInput")
        : pipelinePhase === "thinking"
          ? t("awaitingModel")
      : player.isPlaying
        ? t("voiceOutput")
        : t("controlRoom");
  const statusTitle = isRecording
      ? t("listeningToYourVoice")
      : pipelinePhase === "transcribing"
        ? t("parsingYourVoiceInput")
        : pipelinePhase === "thinking"
          ? t("waitingForProvider", { provider: providerLabel })
      : player.isPlaying
        ? t("speakingBackToYou")
        : t("readyForNextThought");
  const sessionTitle = activeConversation?.title || t("freshSession");
  const sessionMeta = activeConversation
    ? `${t("messageCount", { count: messages.length })} · ${providerLabel} · ${model}`
    : `${providerLabel} · ${model}`;

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

      {viewMode === "default" ? (
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
                    <Text style={[styles.eyebrow, { color: colors.accent }]}>
                      {statusEyebrow}
                    </Text>
                    <Text style={[styles.statusTitle, { color: colors.text }]}>
                      {statusTitle}
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
              <View style={styles.transcriptHeader}>
                <View style={styles.transcriptHeaderCopy}>
                  <Text
                    style={[styles.eyebrow, { color: colors.textSecondary }]}
                  >
                    {t("conversation")}
                  </Text>
                  <Text style={[styles.transcriptTitle, { color: colors.text }]}>
                    {sessionTitle}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.expandButton,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setViewMode("expanded")}
                >
                  <Text
                    style={[styles.expandButtonText, { color: colors.text }]}
                  >
                    {t("open")}
                  </Text>
                  <Feather
                    name="arrow-up-right"
                    size={15}
                    color={colors.accent}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.transcriptHeaderActions}>
                <TouchableOpacity
                  style={[
                    styles.copyButton,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    void handleCopyThread();
                  }}
                >
                  <Feather name="copy" size={14} color={colors.accent} />
                  <Text
                    style={[styles.copyButtonText, { color: colors.text }]}
                  >
                    {t("copyThread")}
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.dragHandle,
                  { backgroundColor: colors.borderStrong },
                ]}
              />

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
      ) : (
        <View style={styles.expandedLayout}>
          {renderTopBar(true)}

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

          <Animated.View
            style={[
              styles.expandedTranscriptDrawer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.glow,
              },
              {
                transform: [{ translateY: expandedDrawerTranslateY }],
              },
            ]}
          >
            <View
              style={styles.expandedDrawerHandleZone}
              {...expandedDrawerPanResponder.panHandlers}
            >
              <View
                style={[
                  styles.dragHandle,
                  { backgroundColor: colors.borderStrong },
                ]}
              />
            </View>

            <View style={styles.expandedTranscriptHeader}>
              <View style={styles.transcriptHeaderCopy}>
                <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
                  {t("transcript")}
                </Text>
                <Text style={[styles.transcriptTitle, { color: colors.text }]}>
                  {sessionTitle}
                </Text>
                <Text
                  style={[
                    styles.expandedTranscriptMeta,
                    { color: colors.textMuted },
                  ]}
                >
                  {providerLabel} · {model}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.copyButton,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  void handleCopyThread();
                }}
              >
                <Feather name="copy" size={14} color={colors.accent} />
                <Text
                  style={[styles.copyButtonText, { color: colors.text }]}
                >
                  {t("copyThread")}
                </Text>
              </TouchableOpacity>
            </View>

            <ChatTranscript
              messages={messages}
              emptyTitle={t("noConversationYet")}
              emptyDescription={t("expandedTranscriptEmptyDescription")}
              contentContainerStyle={styles.expandedTranscriptContent}
              onCopyMessage={(message) => {
                void handleCopyMessage(message.content);
              }}
            />
          </Animated.View>
        </View>
      )}

      <SettingsModal
        visible={settingsVisible}
        settings={settings}
        focusProvider={settingsFocusProvider}
        onUpdate={updateSettings}
        onUpdateProviderModel={updateProviderModel}
        onUpdateProviderTtsVoice={updateProviderTtsVoice}
        onUpdateApiKey={updateApiKey}
        onPreviewVoice={handlePreviewVoice}
        onClose={closeSettings}
      />
      <ConversationDrawer
        visible={drawerVisible}
        conversations={conversations}
        activeId={activeConversation?.id || null}
        onSelect={selectConversation}
        onCopyThread={(id) => {
          void handleCopyThread(id);
        }}
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
    marginTop: 4,
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
  transcriptShell: {
    height: 288,
    borderRadius: 32,
    borderWidth: 1,
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
    paddingTop: 10,
    paddingHorizontal: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 8,
  },
  expandedDrawerHandleZone: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
    paddingBottom: 8,
  },
  expandedTranscriptHeader: {
    gap: 4,
    marginBottom: 10,
  },
  transcriptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  transcriptHeaderActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 10,
  },
  transcriptHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  copyButtonText: {
    fontSize: 12,
    fontFamily: fonts.display,
  },
  transcriptTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: fonts.display,
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
  dragHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
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
  expandedTranscriptMeta: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
});
