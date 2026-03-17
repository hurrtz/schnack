import type { TtsBackendMode, TtsListenLanguage } from "../../types";

export type SpeechDiagnosticSource =
  | "conversation"
  | "repeat"
  | "preview"
  | "unknown";

export type SpeechDiagnosticStage =
  | "tts-requested"
  | "tts-succeeded"
  | "tts-fallback"
  | "tts-failed"
  | "local-attempt"
  | "local-failed"
  | "playback-enqueued"
  | "playback-started"
  | "playback-finished"
  | "playback-stopped"
  | "playback-drained";

export type SpeechDiagnosticRoute = "local" | "provider" | "native";

export interface SpeechDiagnosticsContext {
  requestId?: string;
  source?: SpeechDiagnosticSource;
}

export interface SpeechDiagnosticEvent {
  id: string;
  createdAt: string;
  requestId?: string;
  source: SpeechDiagnosticSource;
  stage: SpeechDiagnosticStage;
  requestedRoute?: SpeechDiagnosticRoute;
  actualRoute?: SpeechDiagnosticRoute;
  language?: TtsListenLanguage | "app";
  mode?: TtsBackendMode;
  provider?: string | null;
  voice?: string | null;
  message?: string;
  fallbackReason?: string;
  textLength?: number;
}

const MAX_SPEECH_DIAGNOSTICS = 200;

let speechDiagnosticEvents: SpeechDiagnosticEvent[] = [];

function nextSpeechDiagnosticId() {
  return `speech-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSpeechRequestId(prefix = "speech") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recordSpeechDiagnostic(
  event: Omit<SpeechDiagnosticEvent, "id" | "createdAt">,
) {
  const entry: SpeechDiagnosticEvent = {
    id: nextSpeechDiagnosticId(),
    createdAt: new Date().toISOString(),
    source: event.source ?? "unknown",
    ...event,
  };

  speechDiagnosticEvents = [entry, ...speechDiagnosticEvents].slice(
    0,
    MAX_SPEECH_DIAGNOSTICS,
  );

  if (
    typeof __DEV__ !== "undefined" &&
    __DEV__ &&
    process.env.NODE_ENV !== "test"
  ) {
    console.info("[speech]", JSON.stringify(entry));
  }

  return entry;
}

export function getSpeechDiagnostics() {
  return [...speechDiagnosticEvents];
}

export function clearSpeechDiagnostics() {
  speechDiagnosticEvents = [];
}
