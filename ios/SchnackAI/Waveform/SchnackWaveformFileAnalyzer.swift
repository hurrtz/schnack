import AVFoundation
import Foundation

enum SchnackWaveformFileAnalyzer {
  static func analyzeAudioFile(
    at url: URL,
    sampleCount: Int
  ) throws -> [String: Any] {
    let targetCount = max(64, sampleCount)
    let audioFile = try AVAudioFile(forReading: url)
    let frameCapacity = AVAudioFrameCount(audioFile.length)

    guard frameCapacity > 0 else {
      return ["samples": [], "durationMs": 0]
    }

    guard
      let buffer = AVAudioPCMBuffer(
        pcmFormat: audioFile.processingFormat,
        frameCapacity: frameCapacity
      )
    else {
      return ["samples": [], "durationMs": 0]
    }

    try audioFile.read(into: buffer)

    let samples = SchnackWaveformAudioAnalysis.extractPeakSamples(
      from: buffer,
      targetCount: targetCount
    )
    let durationMs =
      Double(audioFile.length) / audioFile.processingFormat.sampleRate * 1000

    return [
      "samples": samples.map(Double.init),
      "durationMs": durationMs,
    ]
  }
}
