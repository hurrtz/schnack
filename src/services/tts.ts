import { OPENAI_API_KEY } from "../config";

export async function synthesizeSpeech(text: string, voice: string): Promise<ArrayBuffer> {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "tts-1", voice, input: text, response_format: "aac" }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS API error (${response.status}): ${errorText}`);
  }
  return response.arrayBuffer();
}
