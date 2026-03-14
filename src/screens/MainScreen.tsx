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
import { PROVIDER_LABELS, PROVIDER_ORDER } from "../constants/models";
import { useSharedSettings } from "../context/SettingsContext";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useConversations } from "../hooks/useConversations";
import { runVoicePipeline } from "../services/voicePipeline";
import { synthesizeSpeech } from "../services/tts";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Provider, VoiceVisualPhase } from "../types";

type ViewMode = "default" | "expanded";

export function MainScreen() {
  const { colors, isDark } = useTheme();
  const {
    settings,
    updateSettings,
    updateProviderModel,
    updateApiKey,
    loaded,
  } = useSharedSettings();
  const {
    conversations,
    activeConversation,
    createConversation,
    selectConversation,
    addMessage,
    deleteConversation,
    clearActiveConversation,
  } = useConversations();

  const recorder = useAudioRecorder();
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
  const openAIApiKey = settings.apiKeys.openai.trim();
  const model = settings.providerModels[provider];
  const availableProviders = PROVIDER_ORDER.filter(
    (candidate) => !!settings.apiKeys[candidate].trim()
  );
  const providerLabel = PROVIDER_LABELS[provider];
  const isBusy = pipelinePhase !== "idle";
  const visualPhase: VoiceVisualPhase = recorder.isRecording
    ? "recording"
    : pipelinePhase === "transcribing"
      ? "transcribing"
      : player.isPlaying
        ? "speaking"
        : pipelinePhase === "thinking"
          ? "thinking"
          : "idle";
  const isActive = visualPhase !== "idle";
  const metering = recorder.isRecording
    ? recorder.meteringData
    : player.isPlaying
      ? player.meteringData
      : -160;

  const showToast = useCallback(
    (message: string, onRetry?: () => void) => {
      setToast({ message, onRetry });
    },
    []
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
    if (viewMode === "expanded") {
      expandedDrawerTranslateY.setValue(0);
    }
  }, [expandedDrawerTranslateY, viewMode]);

  const ensureVoiceSessionReady = useCallback(() => {
    if (!openAIApiKey) {
      showToast("Add your OpenAI API key in Settings to use voice input and playback.");
      return false;
    }

    if (!providerApiKey) {
      showToast(`Add your ${providerLabel} API key in Settings to use this provider.`);
      return false;
    }

    return true;
  }, [openAIApiKey, providerApiKey, providerLabel, showToast]);

  const handleRecordingDone = useCallback(
    async (audioUri: string) => {
      setPipelinePhase("transcribing");
      setStreamingText("");
      abortRef.current = new AbortController();
      player.resetCancellation();

      try {
        const transcription = await runVoicePipeline({
          audioUri,
          messages: activeConversation?.messages || [],
          model,
          provider,
          providerApiKey,
          openAIApiKey,
          ttsVoice: settings.ttsVoice,
          ttsPlayback: settings.ttsPlayback,
          abortSignal: abortRef.current!.signal,
          callbacks: {
            onTranscription: (text) => {
              setPipelinePhase("thinking");
              if (!activeConversation) {
                createConversation(text, model);
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
            onError: (error) => {
              setPipelinePhase("idle");
              showToast(error.message, () => handleRecordingDone(audioUri));
            },
          },
        });

        if (!transcription) {
          showToast("Couldn't catch that, try again.");
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
      openAIApiKey,
      player,
      provider,
      providerApiKey,
      settings.ttsPlayback,
      settings.ttsVoice,
      showToast,
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
    const startPromise = recorder.startRecording();
    recordingStartedRef.current = startPromise;
    await startPromise;
  }, [ensureVoiceSessionReady, isBusy, player, recorder]);

  const handlePressOut = useCallback(async () => {
    if (recordingStartedRef.current) {
      await recordingStartedRef.current;
      recordingStartedRef.current = null;
    }
    const uri = await recorder.stopRecording();
    if (uri) {
      handleRecordingDone(uri);
    }
  }, [handleRecordingDone, recorder]);

  const handleTogglePress = useCallback(async () => {
    if (!recorder.isRecording && !player.isPlaying && !isBusy && !ensureVoiceSessionReady()) {
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
    if (recorder.isRecording) {
      const uri = await recorder.stopRecording();
      if (uri) {
        handleRecordingDone(uri);
      }
      return;
    }
    await recorder.startRecording();
  }, [ensureVoiceSessionReady, handleRecordingDone, isBusy, player, recorder]);

  const handleProviderChange = useCallback(
    (nextProvider: Provider) => {
      if (!settings.apiKeys[nextProvider].trim()) {
        showToast(`Add your ${PROVIDER_LABELS[nextProvider]} API key in Settings to enable it.`);
        return;
      }

      updateSettings({ lastProvider: nextProvider });
    },
    [settings.apiKeys, showToast, updateSettings]
  );

  const handlePreviewVoice = useCallback(
    async (text: string, voice: string) => {
      if (!openAIApiKey) {
        showToast("Add your OpenAI API key in Settings to preview voices.");
        return;
      }

      if (recorder.isRecording || isBusy) {
        showToast("Stop the active voice session before previewing a voice.");
        return;
      }

      try {
        if (player.isPlaying) {
          await player.stopPlayback();
        }
        player.resetCancellation();
        const audioUri = await synthesizeSpeech(text, voice, openAIApiKey);
        player.enqueueAudio(audioUri);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Couldn't preview voice.";
        showToast(message);
      }
    },
    [isBusy, openAIApiKey, player, recorder.isRecording, showToast]
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

  const statusEyebrow = recorder.isRecording
      ? "Live Input"
      : pipelinePhase === "transcribing"
        ? "Parsing Input"
        : pipelinePhase === "thinking"
          ? "Awaiting Model"
      : player.isPlaying
        ? "Voice Output"
        : "Control Room";
  const statusTitle = recorder.isRecording
      ? "Listening to your voice"
      : pipelinePhase === "transcribing"
        ? "Parsing your voice input"
        : pipelinePhase === "thinking"
          ? `Waiting for ${providerLabel}`
      : player.isPlaying
        ? "Speaking back to you"
        : "Ready for the next thought";
  const sessionTitle = activeConversation?.title || "Fresh session";
  const sessionMeta = activeConversation
    ? `${messages.length} messages in progress`
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
            VOX
          </Text>
          <Text style={[styles.compactBrandText, { color: colors.accent }]}>
            AI
          </Text>
        </View>
      ) : (
        <View style={styles.wordmark}>
          <Text style={[styles.wordmarkText, { color: colors.text }]}>VOX</Text>
          <Text style={[styles.wordmarkText, { color: colors.accent }]}>AI</Text>
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
                    Start with Groq
                  </Text>
                  <Text
                    style={[
                      styles.providerEmptyText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Groq offers a free tier, so it is the fastest way to unlock
                    the app. Add its API key in Settings and the provider
                    switcher will appear here right away.
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
                      {isActive ? "Live" : "Idle"}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusMetaRow}>
                  <Text style={[styles.statusMeta, { color: colors.textMuted }]}>
                    {sessionMeta}
                  </Text>
                  <Text style={[styles.statusMeta, { color: colors.textMuted }]}>
                    {settings.ttsVoice}
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
                    Conversation
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
                    Open
                  </Text>
                  <Feather
                    name="arrow-up-right"
                    size={15}
                    color={colors.accent}
                  />
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
                emptyTitle="No transcript yet"
                emptyDescription="Start with the voice stage above. Your messages and the model reply will land here instantly."
                contentContainerStyle={styles.previewTranscriptContent}
                scrollEnabled={false}
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
                  Transcript
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
            </View>

            <ChatTranscript
              messages={messages}
              emptyTitle="No conversation yet"
              emptyDescription="Speak with the control above. Pull the drawer handle down when you want to return to the main stage."
              contentContainerStyle={styles.expandedTranscriptContent}
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
        onUpdateApiKey={updateApiKey}
        onPreviewVoice={handlePreviewVoice}
        onClose={closeSettings}
      />
      <ConversationDrawer
        visible={drawerVisible}
        conversations={conversations}
        activeId={activeConversation?.id || null}
        onSelect={selectConversation}
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
    letterSpacing: 2.4,
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
    letterSpacing: 1.6,
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
  transcriptHeaderCopy: {
    flex: 1,
    gap: 4,
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
