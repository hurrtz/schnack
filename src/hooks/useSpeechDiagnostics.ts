import { useSyncExternalStore } from "react";
import {
  getSpeechDiagnosticRequestSummaries,
  subscribeToSpeechDiagnostics,
} from "../services/speech/diagnostics";

export function useSpeechDiagnostics(limit = 8) {
  return useSyncExternalStore(
    subscribeToSpeechDiagnostics,
    () => getSpeechDiagnosticRequestSummaries(limit),
    () => [],
  );
}
