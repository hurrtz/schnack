import {
  clearSpeechDiagnostics,
  getSpeechDiagnosticRequestSummaries,
  recordSpeechDiagnostic,
} from "../../src/services/speech/diagnostics";

describe("speech diagnostics", () => {
  beforeEach(() => {
    clearSpeechDiagnostics();
  });

  it("groups request events into request summaries", () => {
    recordSpeechDiagnostic({
      requestId: "req-1",
      source: "preview",
      stage: "tts-requested",
      requestedRoute: "local",
      language: "en",
    });
    recordSpeechDiagnostic({
      requestId: "req-1",
      source: "preview",
      stage: "tts-fallback",
      requestedRoute: "local",
      actualRoute: "provider",
      fallbackReason: "Local synthesis failed.",
      provider: "openai",
    });
    recordSpeechDiagnostic({
      requestId: "req-1",
      source: "preview",
      stage: "playback-finished",
      actualRoute: "provider",
      voice: "alloy",
    });
    recordSpeechDiagnostic({
      source: "unknown",
      stage: "playback-drained",
    });

    const [summary] = getSpeechDiagnosticRequestSummaries();

    expect(summary).toMatchObject({
      requestId: "req-1",
      source: "preview",
      latestStage: "playback-finished",
      requestedRoute: "local",
      actualRoute: "provider",
      language: "en",
      provider: "openai",
      voice: "alloy",
      fallbackReason: "Local synthesis failed.",
    });
  });
});
