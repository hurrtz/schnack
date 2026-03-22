import * as FileSystem from "expo-file-system/legacy";

function bytesToBase64(bytes: Uint8Array) {
  const BufferCtor = (globalThis as any).Buffer;

  if (BufferCtor) {
    return BufferCtor.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  if (typeof btoa !== "undefined") {
    return btoa(binary);
  }

  throw new Error("No base64 encoder available.");
}

export function normalizeLocalTtsText(text: string) {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/…/g, "...");
}

export function buildWavBytes(floatArray: Float32Array, sampleRate: number) {
  const pcm16 = new Int16Array(floatArray.length);

  for (let index = 0; index < floatArray.length; index += 1) {
    pcm16[index] = Math.max(
      -32768,
      Math.min(32767, Math.floor(floatArray[index] * 32767)),
    );
  }

  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const dataLength = pcm16.length * 2;

  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataLength, true);

  const wavBytes = new Uint8Array(44 + dataLength);
  wavBytes.set(new Uint8Array(header), 0);
  wavBytes.set(new Uint8Array(pcm16.buffer), 44);
  return wavBytes;
}

export async function writeWaveformFile(
  floatArray: Float32Array,
  sampleRate: number,
) {
  const wavBytes = buildWavBytes(floatArray, sampleRate);
  const path = `${FileSystem.cacheDirectory}local-tts-${Date.now()}.wav`;
  await FileSystem.writeAsStringAsync(path, bytesToBase64(wavBytes), {
    encoding: "base64",
  });
  return path;
}
