import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeContext";
import { useSettings } from "../hooks/useSettings";
import { useConversations } from "../hooks/useConversations";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { runVoicePipeline } from "../services/voicePipeline";
import { WaveformCircle } from "../components/WaveformCircle";
import { WaveformBar } from "../components/WaveformBar";
import { ChatTranscript } from "../components/ChatTranscript";
import { ProviderToggle } from "../components/ProviderToggle";
import { SettingsModal } from "../components/SettingsModal";
import { ConversationDrawer } from "../components/ConversationDrawer";
import { Toast } from "../components/Toast";
import { Provider } from "../types";

type ViewMode = "default" | "expanded";

export function MainScreen() {
  const { colors } = useTheme();
  const { settings, updateSettings } = useSettings();
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

  const provider = settings.lastProvider;
  const model =
    provider === "openai" ? settings.openaiModel : settings.anthropicModel;

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
                  showToast(error.message, () =>
                    handleRecordingDone(audioUri)
                  );
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
        // Error already handled via onError callback
      } finally {
        setProcessing(false);
      }
    },
    [
      activeConversation,
      model,
      provider,
      settings.ttsVoice,
      settings.ttsPlayback,
      addMessage,
      createConversation,
      player,
      showToast,
    ]
  );

  const handlePressIn = useCallback(async () => {
    if (player.isPlaying) {
      await player.stopPlayback();
      abortRef.current?.abort();
    }
    await recorder.startRecording();
  }, [player, recorder]);

  const handlePressOut = useCallback(async () => {
    const uri = await recorder.stopRecording();
    if (uri) handleRecordingDone(uri);
  }, [recorder, handleRecordingDone]);

  const handleTogglePress = useCallback(async () => {
    if (player.isPlaying) {
      await player.stopPlayback();
      abortRef.current?.abort();
      return;
    }
    if (recorder.isRecording) {
      const uri = await recorder.stopRecording();
      if (uri) handleRecordingDone(uri);
    } else {
      await recorder.startRecording();
    }
  }, [player, recorder, handleRecordingDone]);

  const handleProviderChange = useCallback(
    (p: Provider) => {
      updateSettings({ lastProvider: p });
    },
    [updateSettings]
  );

  const handleExpandChat = useCallback(() => {
    setViewMode("expanded");
  }, []);

  // Build display messages: actual messages + streaming partial if active
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Toast */}
      <Toast
        message={toast?.message || ""}
        visible={!!toast}
        onDismiss={() => setToast(null)}
        onRetry={toast?.onRetry}
      />

      {viewMode === "default" ? (
        <>
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => setDrawerVisible(true)}
            >
              <Text style={{ color: colors.text }}>☰</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>VoxAI</Text>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => setSettingsVisible(true)}
            >
              <Text style={{ color: colors.text }}>⚙</Text>
            </TouchableOpacity>
          </View>

          {/* Provider toggle */}
          <ProviderToggle
            selected={provider}
            onSelect={handleProviderChange}
          />

          {/* Main button */}
          <View style={styles.buttonArea}>
            <WaveformCircle
              metering={metering}
              isActive={isActive}
              inputMode={settings.inputMode}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleTogglePress}
            />
          </View>

          {/* Chat preview */}
          <View
            style={[styles.chatPreview, { backgroundColor: colors.surface }]}
          >
            <ChatTranscript
              messages={messages}
              onTap={handleExpandChat}
            />
          </View>
        </>
      ) : (
        <>
          {/* Compact top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => setDrawerVisible(true)}
            >
              <Text style={{ color: colors.text }}>☰</Text>
            </TouchableOpacity>
            <WaveformBar
              metering={metering}
              isActive={isActive}
              inputMode={settings.inputMode}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleTogglePress}
            />
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => setSettingsVisible(true)}
            >
              <Text style={{ color: colors.text }}>⚙</Text>
            </TouchableOpacity>
          </View>

          {/* Full chat */}
          <View style={styles.expandedChat}>
            <ChatTranscript messages={messages} />
          </View>

          {/* Pull down to collapse */}
          <TouchableOpacity
            style={styles.collapseHint}
            onPress={() => setViewMode("default")}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              ▼ Back to main view
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Modals */}
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
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: "700", letterSpacing: 1 },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chatPreview: {
    maxHeight: 160,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  expandedChat: { flex: 1 },
  collapseHint: {
    alignItems: "center",
    paddingVertical: 8,
  },
});
