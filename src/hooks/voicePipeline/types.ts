import type { TranslationKey } from "../../i18n";
import type {
  AppLanguage,
  AssistantResponseLength,
  AssistantResponseTone,
  Conversation,
  LocalTtsVoiceSelections,
  Message,
  Provider,
  ReplyPlayback,
  SttBackendMode,
  TtsBackendMode,
  TtsListenLanguage,
  UsageEstimate,
} from "../../types";
import type { useAudioPlayer } from "../useAudioPlayer";

export type PipelinePhase =
  | "idle"
  | "transcribing"
  | "thinking"
  | "synthesizing"
  | "speaking";

export type ReplayPhase = "idle" | "preparing" | "speaking";

export type AudioPlayer = ReturnType<typeof useAudioPlayer>;

export interface UseVoicePipelineParams {
  activeConversation: Conversation | null;
  addMessage: (msg: Omit<Message, "id" | "timestamp">) => void;
  createConversation: (
    firstMessage: string,
    initialModel?: string | null,
    initialProvider?: Provider | null,
  ) => void;
  updateConversationContextSummary: (
    summary: string,
    summarizedCount: number,
    usage?: UsageEstimate,
    usageModel?: string | null,
    usageProvider?: Provider | null,
  ) => void;
  player: AudioPlayer;
  provider: Provider;
  providerApiKey: string;
  model: string;
  sttMode: SttBackendMode;
  sttProvider: Provider | null;
  sttApiKey: string;
  selectedSttModel: string;
  ttsMode: TtsBackendMode;
  ttsProvider: Provider | null;
  ttsApiKey: string;
  selectedTtsModel: string;
  selectedTtsVoice: string;
  ttsListenLanguages: TtsListenLanguage[];
  localTtsVoices: LocalTtsVoiceSelections;
  replyPlayback: ReplyPlayback;
  assistantInstructions: string;
  responseLength: AssistantResponseLength;
  responseTone: AssistantResponseTone;
  language: AppLanguage;
  isRecording: boolean;
  showToast: (message: string, onRetry?: () => void) => void;
  t: (
    key: TranslationKey,
    params?: Record<string, string | number | undefined>,
  ) => string;
}

export interface UseVoicePipelineResult {
  pipelinePhase: PipelinePhase;
  setPipelinePhase: (phase: PipelinePhase) => void;
  streamingText: string;
  setStreamingText: (text: string) => void;
  abortRef: React.MutableRefObject<AbortController | null>;
  lastCompletedReplyRef: React.MutableRefObject<string>;
  replayPhase: ReplayPhase;
  activeReplayMessageId: string | null;
  playReplyText: (text: string, messageId?: string) => Promise<void>;
  handleRepeatLastReply: (
    textOverride?: string,
    messageId?: string,
  ) => Promise<void>;
  stopReplay: () => Promise<void>;
  handleVoiceCaptureDone: (params: {
    audioUri?: string;
    transcriptionOverride?: string;
  }) => Promise<void>;
}
