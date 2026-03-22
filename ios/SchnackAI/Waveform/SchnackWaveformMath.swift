import UIKit

struct SchnackWaveformLiveSnapshot {
  let samples: [CGFloat]
  let updatedAt: CFTimeInterval
  let appendedCount: Int
}

struct SchnackWaveformPlaybackState {
  let itemId: String
  let samples: [CGFloat]
  let durationMs: CFTimeInterval
  let startedAt: CFTimeInterval
}

enum SchnackWaveformMath {
  static func emptySamples(count: Int) -> [CGFloat] {
    Array(repeating: CGFloat.zero, count: count)
  }

  static func normalize(samples: [Float]) -> [CGFloat] {
    samples.map { sample in
      CGFloat(min(1, max(-1, sample)))
    }
  }

  static func normalize(samples: [Double]) -> [CGFloat] {
    samples.map { sample in
      CGFloat(min(1, max(-1, sample)))
    }
  }

  static func delayedLiveSamples(
    snapshots: [SchnackWaveformLiveSnapshot]?,
    channel: SchnackWaveformChannel,
    now: CFTimeInterval,
    inputVisualDelayMs: CFTimeInterval
  ) -> [CGFloat]? {
    guard let snapshots, let latestSnapshot = snapshots.last else {
      return nil
    }

    guard channel == .input, snapshots.count > 1 else {
      return latestSnapshot.samples
    }

    let targetTime = now - inputVisualDelayMs / 1000
    guard targetTime > snapshots[0].updatedAt else {
      return snapshots[0].samples
    }

    guard let upperIndex = snapshots.firstIndex(where: { $0.updatedAt >= targetTime }) else {
      return latestSnapshot.samples
    }

    guard upperIndex > 0 else {
      return snapshots[upperIndex].samples
    }

    let previousSnapshot = snapshots[upperIndex - 1]
    let nextSnapshot = snapshots[upperIndex]
    let duration = max(0.001, nextSnapshot.updatedAt - previousSnapshot.updatedAt)
    let progress = min(
      1,
      max(0, (targetTime - previousSnapshot.updatedAt) / duration)
    )

    guard
      previousSnapshot.samples.count == nextSnapshot.samples.count,
      nextSnapshot.appendedCount > 0
    else {
      return interpolateSamples(
        from: previousSnapshot.samples,
        to: nextSnapshot.samples,
        progress: progress
      )
    }

    let shiftCount = min(
      nextSnapshot.appendedCount,
      max(1, nextSnapshot.samples.count)
    )
    let appendedTail = Array(nextSnapshot.samples.suffix(shiftCount))
    let virtualSamples = previousSnapshot.samples + appendedTail

    return (0..<nextSnapshot.samples.count).map { index in
      let position = CGFloat(index) + CGFloat(shiftCount) * progress
      return sampleValue(in: virtualSamples, at: position)
    }
  }

  static func interpolateSamples(
    from previousSamples: [CGFloat],
    to currentSamples: [CGFloat],
    progress: CFTimeInterval
  ) -> [CGFloat] {
    guard previousSamples.count == currentSamples.count else {
      return currentSamples
    }

    let normalizedProgress = CGFloat(min(1, max(0, progress)))
    return zip(previousSamples, currentSamples).map {
      ($0 * (1 - normalizedProgress)) + ($1 * normalizedProgress)
    }
  }

  static func sampleValue(in samples: [CGFloat], at position: CGFloat) -> CGFloat {
    guard !samples.isEmpty else {
      return .zero
    }

    let clampedPosition = min(
      CGFloat(samples.count - 1),
      max(CGFloat.zero, position)
    )
    let leftIndex = Int(floor(clampedPosition))
    let rightIndex = min(samples.count - 1, leftIndex + 1)
    let blend = clampedPosition - CGFloat(leftIndex)

    return (samples[leftIndex] * (1 - blend)) + (samples[rightIndex] * blend)
  }

  static func playbackWindow(
    playbackState: SchnackWaveformPlaybackState,
    now: CFTimeInterval,
    defaultSampleCount: Int
  ) -> [CGFloat] {
    guard !playbackState.samples.isEmpty else {
      return emptySamples(count: defaultSampleCount)
    }

    let progress = min(
      1,
      max(0, ((now - playbackState.startedAt) * 1000) / max(1, playbackState.durationMs))
    )
    let currentIndex = Int(
      round(progress * Double(max(0, playbackState.samples.count - 1)))
    )
    let lowerBound = max(0, currentIndex - defaultSampleCount + 1)
    let window = Array(playbackState.samples[lowerBound...currentIndex])

    if window.count >= defaultSampleCount {
      return window
    }

    return
      Array(repeating: 0, count: defaultSampleCount - window.count) +
      window
  }
}
