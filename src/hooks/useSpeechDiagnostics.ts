import { useEffect, useState } from "react";
import {
  getSpeechDiagnosticRequestSummaries,
  subscribeToSpeechDiagnostics,
} from "../services/speech/diagnostics";

export function useSpeechDiagnostics(limit = 8) {
  const [summaries, setSummaries] = useState(() =>
    getSpeechDiagnosticRequestSummaries(limit),
  );

  useEffect(() => {
    setSummaries(getSpeechDiagnosticRequestSummaries(limit));

    return subscribeToSpeechDiagnostics(() => {
      setSummaries(getSpeechDiagnosticRequestSummaries(limit));
    });
  }, [limit]);

  return summaries;
}
