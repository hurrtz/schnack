import { useRef, useState } from "react";

import { useReplyReplayController } from "./voicePipeline/useReplyReplayController";
import { useVoiceCaptureHandler } from "./voicePipeline/useVoiceCaptureHandler";
import type {
  PipelinePhase,
  UseVoicePipelineParams,
  UseVoicePipelineResult,
} from "./voicePipeline/types";

export type { PipelinePhase, ReplayPhase } from "./voicePipeline/types";
export type { UseVoicePipelineParams, UseVoicePipelineResult } from "./voicePipeline/types";

export function useVoicePipeline(
  params: UseVoicePipelineParams,
): UseVoicePipelineResult {
  const [pipelinePhase, setPipelinePhase] = useState<PipelinePhase>("idle");
  const [streamingText, setStreamingText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const lastCompletedReplyRef = useRef("");
  const isBusy = pipelinePhase !== "idle";

  const {
    replayPhase,
    activeReplayMessageId,
    playReplyText,
    stopReplay,
    handleRepeatLastReply,
  } = useReplyReplayController({
    isBusy,
    isRecording: params.isRecording,
    language: params.language,
    lastCompletedReplyRef,
    localTtsVoices: params.localTtsVoices,
    player: params.player,
    selectedTtsModel: params.selectedTtsModel,
    selectedTtsVoice: params.selectedTtsVoice,
    showToast: params.showToast,
    t: params.t,
    ttsApiKey: params.ttsApiKey,
    ttsListenLanguages: params.ttsListenLanguages,
    ttsMode: params.ttsMode,
    ttsProvider: params.ttsProvider,
  });

  const { handleVoiceCaptureDone } = useVoiceCaptureHandler({
    ...params,
    abortRef,
    handleRepeatLastReply,
    lastCompletedReplyRef,
    setPipelinePhase,
    setStreamingText,
  });

  return {
    pipelinePhase,
    setPipelinePhase,
    streamingText,
    setStreamingText,
    abortRef,
    lastCompletedReplyRef,
    replayPhase,
    activeReplayMessageId,
    playReplyText,
    handleRepeatLastReply,
    stopReplay,
    handleVoiceCaptureDone,
  };
}
