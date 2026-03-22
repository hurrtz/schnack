import React, { useState, useCallback, useEffect } from "react";
import {
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
import { useTheme } from "../theme/ThemeContext";
import {
  Provider,
  ResponseMode,
  TtsListenLanguage,
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
import { MainScreenTopBar } from "./main/MainScreenTopBar";
import { StatusDetailsModal } from "./main/StatusDetailsModal";
import { TranscriptModal } from "./main/TranscriptModal";
import {
  getStatusDisplayData,
  getStatusIndicatorTone,
} from "./main/statusSelectors";
import { styles } from "./main/styles";
import { getConversationUsageDisplayData } from "./main/usageSelectors";
import { useConversationActions } from "./main/useConversationActions";
import { useMainScreenUiState } from "./main/useMainScreenUiState";
import { usePreviewVoiceController } from "./main/usePreviewVoiceController";
import { useProviderAvailabilityGuards } from "./main/useProviderAvailabilityGuards";
import { useSetupGuideController } from "./main/useSetupGuideController";
import { useVoiceSessionController } from "./main/useVoiceSessionController";

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

  useProviderAvailabilityGuards({
    activeResponseMode,
    availableResponseModes,
    availableSttProviders,
    availableTtsProviders,
    loaded,
    providerApiKey,
    settings,
    sttProvider,
    ttsProvider,
    updateActiveResponseMode,
    updateSettings,
  });

  const {
    handleDismissSetupGuide,
    handleChooseSetupPreset,
  } = useSetupGuideController({
    loaded,
    openSettings,
    setSetupGuideVisible,
    setupGuideDismissed: settings.setupGuideDismissed,
    updateSettings,
  });

  const {
    handlePressIn,
    handlePressOut,
    handleTogglePress,
    resetVoiceSessionState,
  } = useVoiceSessionController({
    abortRef,
    availableSttProviders,
    availableTtsProviders,
    captureActiveConversationSnapshot,
    handleVoiceCaptureDone,
    isBusy,
    isRecording,
    lastCompletedReplyRef,
    nativeStt,
    player,
    providerApiKey,
    providerLabel,
    recorder,
    restoreActiveConversationSnapshot,
    setPipelinePhase,
    setStreamingText,
    settings,
    showToast,
    sttApiKey,
    sttProvider,
    t,
    ttsApiKey,
    ttsProvider,
  });

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

  const { handlePreviewVoice, stopPreviewVoice } = usePreviewVoiceController({
    isBusy,
    isRecording,
    language,
    player,
    refreshLocalTtsPackStates,
    settings,
    showToast,
    t,
    ttsProvider,
  });

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

  const routeModelLabel = `${responseModeLabel} · ${providerLabel} · ${modelLabel}`;
  const statusDisplay = getStatusDisplayData({
    inputMode: settings.inputMode,
    messageCount: messages.length,
    pipelinePhase,
    providerLabel,
    t,
    ttsProviderLabel: ttsProvider ? PROVIDER_LABELS[ttsProvider] : providerLabel,
    visualPhase,
  });
  const statusIndicatorTone = getStatusIndicatorTone(visualPhase, pipelinePhase);
  const activeConversationTitle =
    activeConversation?.title.trim() || t("untitledConversation");
  const usageDisplay = getConversationUsageDisplayData({
    conversation: activeConversation,
    showUsageStats: settings.showUsageStats,
    t,
  });

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
                        backgroundColor:
                          statusIndicatorTone === "danger"
                            ? colors.danger
                            : statusIndicatorTone === "accent"
                              ? colors.accent
                              : statusIndicatorTone === "muted"
                                ? colors.textMuted
                                : statusIndicatorTone === "success"
                                  ? colors.success
                                  : colors.accentWarm,
                      },
                    ]}
                  />
                  <Text
                    style={[styles.statusStripTitle, { color: colors.text }]}
                  >
                    {statusDisplay.actionLabel}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.statusStripDetail,
                    { color: colors.textSecondary },
                  ]}
                >
                  {statusDisplay.statusDetail}
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

      <StatusDetailsModal
        visible={statusDetailsVisible}
        colors={colors}
        fallbackTtsStatusLabel={fallbackTtsStatusLabel}
        isActive={isActive}
        messageCountLabel={statusDisplay.messageCountLabel}
        onClose={closeStatusDetails}
        routeModelLabel={routeModelLabel}
        statusDetail={statusDisplay.statusDetail}
        statusTitle={statusDisplay.statusTitle}
        sttStatusLabel={sttStatusLabel}
        t={t}
        ttsStatusLabel={ttsStatusLabel}
      />

      <TranscriptModal
        visible={transcriptVisible}
        activeConversationTitle={activeConversationTitle}
        activeReplayMessageId={activeReplayMessageId}
        colors={colors}
        conversationMenuVisible={conversationMenuVisible}
        insets={insets}
        isActive={isActive}
        metering={metering}
        messages={messages}
        onClose={closeTranscript}
        onCloseConversationMenu={closeConversationMenu}
        onCopyMessage={(message) => {
          void handleCopyMessage(message.content);
        }}
        onCopyThread={() => {
          closeConversationMenu();
          void handleCopyThread();
        }}
        onManageMemory={() => {
          closeConversationMenu();
          void openMemory();
        }}
        onPress={handleTogglePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onRepeatMessage={(message) => {
          void handleRepeatMessage(message);
        }}
        onShareMessage={(message) => {
          void handleShareMessage(message.content);
        }}
        onShareThread={() => {
          closeConversationMenu();
          void handleShareThread();
        }}
        replayPhase={replayPhase}
        settingsShowUsageStats={settings.showUsageStats}
        signalLevels={signalLevels}
        signalWaveformVariant={signalWaveformVariant}
        t={t}
        toggleConversationMenu={toggleConversationMenu}
        usageDisplay={usageDisplay}
        visualPhase={visualPhase}
        waveformInputMode={settings.inputMode}
      />

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
