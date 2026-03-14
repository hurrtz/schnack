import React, { useState, useCallback, useRef } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { ChatTranscript } from "../components/ChatTranscript";
import { ConversationDrawer } from "../components/ConversationDrawer";
import { ProviderToggle } from "../components/ProviderToggle";
import { SettingsModal } from "../components/SettingsModal";
import { Toast } from "../components/Toast";
import { WaveformBar } from "../components/WaveformBar";
import { WaveformCircle } from "../components/WaveformCircle";
import { useSharedSettings } from "../context/SettingsContext";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useConversations } from "../hooks/useConversations";
import { runVoicePipeline } from "../services/voicePipeline";
import { useTheme } from "../theme/ThemeContext";
import { fonts } from "../theme/typography";
import { Provider } from "../types";

type ViewMode = "default" | "expanded";

export function MainScreen() {
  const { colors, isDark } = useTheme();
  const { settings, updateSettings } = useSharedSettings();
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
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    onRetry?: () => void;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const recordingStartedRef = useRef<Promise<void> | null>(null);

  const provider = settings.lastProvider;
  const model =
    provider === "openai" ? settings.openaiModel : settings.anthropicModel;
  const providerLabel = provider === "openai" ? "OpenAI" : "Anthropic";

  const isActive = recorder.isRecording || player.isPlaying || processing;
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

  const handleRecordingDone = useCallback(
    async (audioUri: string) => {
      setProcessing(true);
      abortRef.current = new AbortController();
      player.resetCancellation();

      try {
        const transcription = await new Promise<string | null>(
          (resolve, reject) => {
            runVoicePipeline({
              audioUri,
              messages: activeConversation?.messages || [],
              model,
              provider,
              ttsVoice: settings.ttsVoice,
              ttsPlayback: settings.ttsPlayback,
              abortSignal: abortRef.current!.signal,
              callbacks: {
                onTranscription: (text) => {
                  if (!activeConversation) {
                    createConversation(text);
                  }
                  setTimeout(() => {
                    addMessage({
                      role: "user",
                      content: text,
                      model: null,
                      provider: null,
                    });
                  }, 0);
                  resolve(text);
                },
                onChunk: (text) => {
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
                  showToast(error.message, () => handleRecordingDone(audioUri));
                  reject(error);
                },
              },
            });
          }
        );

        if (!transcription) {
          showToast("Couldn't catch that, try again.");
        }
      } catch {
        // Errors are surfaced through the toast callback above.
      } finally {
        setProcessing(false);
      }
    },
    [
      activeConversation,
      addMessage,
      createConversation,
      model,
      player,
      provider,
      settings.ttsPlayback,
      settings.ttsVoice,
      showToast,
    ]
  );

  const handlePressIn = useCallback(async () => {
    if (player.isPlaying) {
      await player.stopPlayback();
      abortRef.current?.abort();
    }
    const startPromise = recorder.startRecording();
    recordingStartedRef.current = startPromise;
    await startPromise;
  }, [player, recorder]);

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
    if (player.isPlaying) {
      await player.stopPlayback();
      abortRef.current?.abort();
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
  }, [handleRecordingDone, player, recorder]);

  const handleProviderChange = useCallback(
    (nextProvider: Provider) => {
      updateSettings({ lastProvider: nextProvider });
    },
    [updateSettings]
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

  const statusEyebrow = processing
    ? "Pipeline"
    : recorder.isRecording
      ? "Live Input"
      : player.isPlaying
        ? "Voice Output"
        : "Control Room";
  const statusTitle = processing
    ? "Composing your reply"
    : recorder.isRecording
      ? "Listening to your voice"
      : player.isPlaying
        ? "Speaking back to you"
        : "Ready for the next thought";
  const statusDescription = processing
    ? `${providerLabel} is shaping the response with ${model}.`
    : recorder.isRecording
      ? "Keep speaking naturally. Release when you want VoxAI to respond."
      : player.isPlaying
        ? "Tap the control to interrupt playback and jump back into the conversation."
        : "A voice-first space for speaking with frontier models without breaking flow.";
  const controlSummary =
    settings.inputMode === "push-to-talk" ? "Hold to speak" : "Tap to speak";
  const playbackSummary =
    settings.ttsPlayback === "stream" ? "Replies stream aloud" : "Replies play after completion";
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
        onPress={() => setSettingsVisible(true)}
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
              <View style={styles.heroHeader}>
                <View style={styles.heroCopy}>
                  <Text style={[styles.eyebrow, { color: colors.accent }]}>
                    Voice-first model studio
                  </Text>
                </View>
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
                    style={[
                      styles.livePillText,
                      { color: colors.textSecondary },
                    ]}
                  >
                  {isActive ? "Live" : "Idle"}
                  </Text>
                </View>
              </View>

              <ProviderToggle
                selected={provider}
                onSelect={handleProviderChange}
              />

              <View style={styles.metaRow}>
                <View
                  style={[
                    styles.metaChip,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Feather name="mic" size={15} color={colors.accent} />
                  <Text
                    style={[
                      styles.metaChipText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {controlSummary}
                  </Text>
                </View>
                <View
                  style={[
                    styles.metaChip,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Feather
                    name="volume-2"
                    size={15}
                    color={colors.accentWarm}
                  />
                  <Text
                    style={[
                      styles.metaChipText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {playbackSummary}
                  </Text>
                </View>
              </View>
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
                  <View>
                    <Text style={[styles.eyebrow, { color: colors.accent }]}>
                      {statusEyebrow}
                    </Text>
                    <Text style={[styles.statusTitle, { color: colors.text }]}>
                      {statusTitle}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.sessionBadge,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sessionBadgeText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {providerLabel}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.statusDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  {statusDescription}
                </Text>
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

          <View
            style={[
              styles.expandedControlCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.glow,
              },
            ]}
          >
            <View style={styles.expandedControlCopy}>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>
                Live session
              </Text>
              <Text style={[styles.expandedControlTitle, { color: colors.text }]}>
                {statusTitle}
              </Text>
              <Text
                style={[
                  styles.expandedControlDescription,
                  { color: colors.textSecondary },
                ]}
              >
                {providerLabel} · {model}
              </Text>
            </View>
            <WaveformBar
              metering={metering}
              isActive={isActive}
              inputMode={settings.inputMode}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleTogglePress}
            />
          </View>

          <View
            style={[
              styles.expandedTranscriptShell,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.glow,
              },
            ]}
          >
            <View style={styles.transcriptHeader}>
              <View style={styles.transcriptHeaderCopy}>
                <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
                  Transcript
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
                onPress={() => setViewMode("default")}
              >
                <Feather name="chevron-down" size={15} color={colors.accent} />
                <Text style={[styles.expandButtonText, { color: colors.text }]}>
                  Stage
                </Text>
              </TouchableOpacity>
            </View>

            <ChatTranscript
              messages={messages}
              emptyTitle="No conversation yet"
              emptyDescription="Return to the stage view when you want the large live control back."
              contentContainerStyle={styles.expandedTranscriptContent}
            />
          </View>
        </View>
      )}

      <SettingsModal
        visible={settingsVisible}
        settings={settings}
        onUpdate={updateSettings}
        onClose={() => setSettingsVisible(false)}
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
    paddingBottom: 18,
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
    borderRadius: 32,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
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
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    justifyContent: "center",
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
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaChipText: {
    fontSize: 13,
    fontFamily: fonts.body,
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
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  statusTitle: {
    marginTop: 4,
    fontSize: 24,
    lineHeight: 28,
    fontFamily: fonts.display,
  },
  sessionBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sessionBadgeText: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  statusDescription: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
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
  expandedTranscriptShell: {
    flex: 1,
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
    paddingBottom: 32,
  },
  expandedControlCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 8,
  },
  expandedControlCopy: {
    marginBottom: 14,
    gap: 4,
  },
  expandedControlTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontFamily: fonts.display,
  },
  expandedControlDescription: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
});
