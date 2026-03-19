export function logWaveformDebug(
  event: string,
  payload: Record<string, unknown> = {},
) {
  console.info(
    "[waveform-debug]",
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      ...payload,
    }),
  );
}
