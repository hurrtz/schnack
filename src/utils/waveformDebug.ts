export function logWaveformDebug(
  event: string,
  payload: Record<string, unknown> = {},
) {
  if (
    typeof __DEV__ === "undefined" ||
    !__DEV__ ||
    process.env.NODE_ENV === "test"
  ) {
    return;
  }

  console.info(
    "[waveform-debug]",
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      ...payload,
    }),
  );
}
