import AVFoundation
import Foundation

final class SchnackWaveformInputProcessor {
  private let referenceFloor: Float
  private let stateLock = NSLock()
  private var inputReferenceLevel: Float
  private var inputVisualGain: Float = 1
  private var inputEnvelopeLevel: Float = 0

  init(referenceFloor: Float) {
    self.referenceFloor = referenceFloor
    self.inputReferenceLevel = referenceFloor
  }

  func reset() {
    stateLock.lock()
    inputReferenceLevel = referenceFloor
    inputVisualGain = 1
    inputEnvelopeLevel = 0
    stateLock.unlock()
  }

  func shape(samples: [Float]) -> [Float] {
    stateLock.lock()
    defer { stateLock.unlock() }

    guard !samples.isEmpty else {
      return samples
    }

    let averageMagnitude =
      samples.reduce(Float.zero) { partialResult, sample in
        partialResult + sample
      } / Float(max(1, samples.count))

    let isNearSilence = averageMagnitude < 0.01
    let detectedLevel =
      isNearSilence
        ? Float.zero
        : averageMagnitude * 2.85

    if isNearSilence {
      inputReferenceLevel = max(referenceFloor, inputReferenceLevel * 0.992)
    } else {
      inputReferenceLevel = max(
        referenceFloor,
        detectedLevel > inputReferenceLevel
          ? inputReferenceLevel * 0.94 + detectedLevel * 0.06
          : inputReferenceLevel * 0.985 + detectedLevel * 0.015
      )
    }

    let targetGain =
      isNearSilence
        ? Float(1)
        : min(
            Float(8.8),
            max(
              Float(2.1),
              Float(0.8) / max(referenceFloor, inputReferenceLevel)
            )
          )

    if abs(targetGain - inputVisualGain) > 0.025 {
      inputVisualGain =
        targetGain > inputVisualGain
          ? inputVisualGain * 0.968 + targetGain * 0.032
          : inputVisualGain * 0.989 + targetGain * 0.011
    }

    let shapedSamples = samples.map { sample -> Float in
      guard sample >= 0.0035 else {
        return Float.zero
      }

      let shapedMagnitude = powf(sample, 0.68)
      return SchnackWaveformAudioAnalysis.clamp(sample: shapedMagnitude * inputVisualGain)
    }

    return shapedSamples.enumerated().map { index, sample in
      let previous = shapedSamples[index - 1 >= 0 ? index - 1 : index]
      let next = shapedSamples[index + 1 < shapedSamples.count ? index + 1 : index]
      return SchnackWaveformAudioAnalysis.clamp(
        sample: previous * 0.26 + sample * 0.48 + next * 0.26
      )
    }
  }

  func extractEnvelopeSamples(
    from buffer: AVAudioPCMBuffer,
    targetCount: Int
  ) -> [Float] {
    stateLock.lock()
    defer { stateLock.unlock() }

    let frameCount = Int(buffer.frameLength)
    guard frameCount > 0, targetCount > 0 else {
      return Array(repeating: 0, count: max(0, targetCount))
    }

    let channelCount = Int(buffer.format.channelCount)
    let chunkSize = max(1, frameCount / targetCount)
    var nextEnvelopeLevel = inputEnvelopeLevel

    let samples = (0..<targetCount).map { index in
      let start = index * chunkSize
      let end =
        index == targetCount - 1
          ? frameCount
          : min(frameCount, start + chunkSize)

      guard start < end else {
        return nextEnvelopeLevel
      }

      var energySum: Float = 0
      var peakMagnitude: Float = 0
      var sampleCount = 0

      for frameIndex in start..<end {
        let sample =
          (0..<channelCount).reduce(Float.zero) { partialResult, channelIndex in
            partialResult +
              SchnackWaveformAudioAnalysis.sampleValue(
                in: buffer,
                channel: channelIndex,
                frame: frameIndex
              )
          } / Float(max(1, channelCount))

        let magnitude = abs(sample)
        energySum += magnitude * magnitude
        peakMagnitude = max(peakMagnitude, magnitude)
        sampleCount += 1
      }

      guard sampleCount > 0 else {
        return nextEnvelopeLevel
      }

      let rms = sqrtf(energySum / Float(sampleCount))
      let targetEnvelope = min(1, max(rms * 2.2, peakMagnitude * 0.65))
      let attack: Float = targetEnvelope > nextEnvelopeLevel ? 0.32 : 0.08
      nextEnvelopeLevel += (targetEnvelope - nextEnvelopeLevel) * attack

      return SchnackWaveformAudioAnalysis.clamp(sample: nextEnvelopeLevel)
    }

    inputEnvelopeLevel = nextEnvelopeLevel
    return samples
  }
}
