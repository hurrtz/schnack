import { type SpeechDiagnosticsContext } from "../../services/speech/diagnostics";
import { type NativeWaveformAnalysis } from "../../services/nativeWaveform";

export type AudioQueueItem = {
  id: string;
  uri: string;
  diagnostics?: SpeechDiagnosticsContext;
};

export type NativeSpeechQueueItem = {
  id: string;
  text: string;
  voice?: string;
  diagnostics?: SpeechDiagnosticsContext;
};

export type NativeAudioQueueContext = {
  uri: string;
  diagnostics?: SpeechDiagnosticsContext;
  waveformAnalysis?: Promise<NativeWaveformAnalysis | null>;
};
