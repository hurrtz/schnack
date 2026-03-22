import UIKit

enum SchnackWaveformChannel: String {
  case input
  case output
}

enum SchnackWaveformRenderStyle: String {
  case automatic
  case waveform
  case envelope
}

final class SchnackWaveformCoordinator {
  static let shared = SchnackWaveformCoordinator()

  private let stateLock = NSLock()
  private let defaultSampleCount = 192
  private let inputVisualDelayMs: CFTimeInterval = 72
  private let maxLiveSnapshots = 40
  private var liveSnapshotsByChannel: [SchnackWaveformChannel: [SchnackWaveformLiveSnapshot]]
  private var playbackStateByChannel: [SchnackWaveformChannel: SchnackWaveformPlaybackState]

  private init() {
    let initialSnapshot = SchnackWaveformLiveSnapshot(
      samples: SchnackWaveformMath.emptySamples(count: defaultSampleCount),
      updatedAt: CACurrentMediaTime(),
      appendedCount: 0
    )
    liveSnapshotsByChannel = [
      .input: [initialSnapshot],
      .output: [initialSnapshot],
    ]
    playbackStateByChannel = [:]
  }

  func setSamples(
    channel: SchnackWaveformChannel,
    samples: [Float],
    appendedCount: Int = 0
  ) {
    appendSnapshot(
      channel: channel,
      samples: SchnackWaveformMath.normalize(samples: samples),
      appendedCount: appendedCount
    )
  }

  func setSamples(
    channel: SchnackWaveformChannel,
    samples: [Double],
    appendedCount: Int = 0
  ) {
    appendSnapshot(
      channel: channel,
      samples: SchnackWaveformMath.normalize(samples: samples),
      appendedCount: appendedCount
    )
  }

  func clear(channel: SchnackWaveformChannel) {
    stateLock.lock()
    let count =
      max(
        defaultSampleCount,
        liveSnapshotsByChannel[channel]?.last?.samples.count ?? defaultSampleCount
      )
    liveSnapshotsByChannel[channel] = [
      SchnackWaveformLiveSnapshot(
        samples: SchnackWaveformMath.emptySamples(count: count),
        updatedAt: CACurrentMediaTime(),
        appendedCount: 0
      ),
    ]
    playbackStateByChannel[channel] = nil
    stateLock.unlock()
  }

  func samples(for channel: SchnackWaveformChannel) -> [CGFloat] {
    stateLock.lock()
    let samples: [CGFloat]
    if let playbackState = playbackStateByChannel[channel] {
      samples = SchnackWaveformMath.playbackWindow(
        playbackState: playbackState,
        now: CACurrentMediaTime(),
        defaultSampleCount: defaultSampleCount
      )
    } else {
      samples =
        SchnackWaveformMath.delayedLiveSamples(
          snapshots: liveSnapshotsByChannel[channel],
          channel: channel,
          now: CACurrentMediaTime(),
          inputVisualDelayMs: inputVisualDelayMs
        ) ??
        SchnackWaveformMath.emptySamples(count: defaultSampleCount)
    }
    stateLock.unlock()
    return samples
  }

  func startPlayback(
    channel: SchnackWaveformChannel,
    itemId: String,
    samples: [Double],
    durationMs: Double
  ) {
    stateLock.lock()
    playbackStateByChannel[channel] = SchnackWaveformPlaybackState(
      itemId: itemId,
      samples: SchnackWaveformMath.normalize(samples: samples),
      durationMs: max(1, durationMs),
      startedAt: CACurrentMediaTime()
    )
    stateLock.unlock()
  }

  func stopPlayback(channel: SchnackWaveformChannel, itemId: String?) {
    stateLock.lock()
    if let currentPlayback = playbackStateByChannel[channel] {
      if itemId == nil || currentPlayback.itemId == itemId {
        playbackStateByChannel[channel] = nil
        let count =
          max(
            defaultSampleCount,
            liveSnapshotsByChannel[channel]?.last?.samples.count ?? defaultSampleCount
          )
        liveSnapshotsByChannel[channel] = [
          SchnackWaveformLiveSnapshot(
            samples: SchnackWaveformMath.emptySamples(count: count),
            updatedAt: CACurrentMediaTime(),
            appendedCount: 0
          ),
        ]
      }
    }
    stateLock.unlock()
  }

  private func appendSnapshot(
    channel: SchnackWaveformChannel,
    samples: [CGFloat],
    appendedCount: Int
  ) {
    stateLock.lock()
    let snapshot = SchnackWaveformLiveSnapshot(
      samples: samples,
      updatedAt: CACurrentMediaTime(),
      appendedCount: max(0, appendedCount)
    )
    var snapshots = liveSnapshotsByChannel[channel] ?? []
    snapshots.append(snapshot)
    if snapshots.count > maxLiveSnapshots {
      snapshots.removeFirst(snapshots.count - maxLiveSnapshots)
    }
    liveSnapshotsByChannel[channel] = snapshots
    stateLock.unlock()
  }
}
