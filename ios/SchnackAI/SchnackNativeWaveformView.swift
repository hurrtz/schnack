import UIKit
import React

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

  private struct LiveSnapshot {
    let samples: [CGFloat]
    let updatedAt: CFTimeInterval
    let appendedCount: Int
  }

  private struct PlaybackState {
    let itemId: String
    let samples: [CGFloat]
    let durationMs: CFTimeInterval
    let startedAt: CFTimeInterval
  }

  private let stateLock = NSLock()
  private let defaultSampleCount = 192
  private let inputVisualDelayMs: CFTimeInterval = 72
  private let maxLiveSnapshots = 40
  private var liveSnapshotsByChannel: [SchnackWaveformChannel: [LiveSnapshot]]
  private var playbackStateByChannel: [SchnackWaveformChannel: PlaybackState]

  private init() {
    let emptySamples = Array(repeating: CGFloat.zero, count: defaultSampleCount)
    let initialSnapshot = LiveSnapshot(
      samples: emptySamples,
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
    let normalizedSamples = samples.map { sample in
      CGFloat(min(1, max(-1, sample)))
    }

    stateLock.lock()
    let snapshot = LiveSnapshot(
      samples: normalizedSamples,
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

  func setSamples(
    channel: SchnackWaveformChannel,
    samples: [Double],
    appendedCount: Int = 0
  ) {
    let normalizedSamples = samples.map { sample in
      CGFloat(min(1, max(-1, sample)))
    }

    stateLock.lock()
    let snapshot = LiveSnapshot(
      samples: normalizedSamples,
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

  func clear(channel: SchnackWaveformChannel) {
    stateLock.lock()
    let count =
      max(
        defaultSampleCount,
        liveSnapshotsByChannel[channel]?.last?.samples.count ?? defaultSampleCount
      )
    let emptySamples = Array(repeating: CGFloat.zero, count: count)
    liveSnapshotsByChannel[channel] = [
      LiveSnapshot(
        samples: emptySamples,
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
      samples = playbackWindow(for: playbackState, now: CACurrentMediaTime())
    } else {
      samples =
        delayedLiveSamples(
          from: liveSnapshotsByChannel[channel],
          channel: channel,
          now: CACurrentMediaTime()
        ) ??
        Array(repeating: CGFloat.zero, count: defaultSampleCount)
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
    let normalizedSamples = samples.map { sample in
      CGFloat(min(1, max(-1, sample)))
    }

    stateLock.lock()
    playbackStateByChannel[channel] = PlaybackState(
      itemId: itemId,
      samples: normalizedSamples,
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
        let emptySamples = Array(repeating: CGFloat.zero, count: count)
        liveSnapshotsByChannel[channel] = [
          LiveSnapshot(
            samples: emptySamples,
            updatedAt: CACurrentMediaTime(),
            appendedCount: 0
          ),
        ]
      }
    }
    stateLock.unlock()
  }

  private func delayedLiveSamples(
    from snapshots: [LiveSnapshot]?,
    channel: SchnackWaveformChannel,
    now: CFTimeInterval
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

  private func interpolateSamples(
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

  private func sampleValue(in samples: [CGFloat], at position: CGFloat) -> CGFloat {
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

  private func playbackWindow(
    for playbackState: PlaybackState,
    now: CFTimeInterval
  ) -> [CGFloat] {
    guard !playbackState.samples.isEmpty else {
      return Array(repeating: CGFloat.zero, count: defaultSampleCount)
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

final class SchnackWaveformView: UIView {
  @objc var channel: NSString = SchnackWaveformChannel.input.rawValue as NSString {
    didSet {
      waveformChannel =
        SchnackWaveformChannel(rawValue: channel as String) ?? .input
      updateLayerAppearance()
      redrawCurrentFrame()
    }
  }

  @objc var renderStyle: NSString = SchnackWaveformRenderStyle.automatic.rawValue as NSString {
    didSet {
      updateLayerAppearance()
      redrawCurrentFrame()
    }
  }

  @objc var active: Bool = true {
    didSet {
      updateLayerAppearance()
      updateDisplayLinkState()
    }
  }

  @objc var lineColor: UIColor = UIColor(white: 1, alpha: 0.96) {
    didSet {
      updateLayerAppearance()
    }
  }

  @objc var baselineColor: UIColor = UIColor(white: 1, alpha: 0.12) {
    didSet {
      updateLayerAppearance()
    }
  }

  @objc var lineWidth: NSNumber = 3.0 {
    didSet {
      updateLayerAppearance()
    }
  }

  private let baselineLayer = CAShapeLayer()
  private let fillLayer = CAShapeLayer()
  private let glowLayer = CAShapeLayer()
  private let waveformLayer = CAShapeLayer()
  private let displayScale = UIScreen.main.scale
  private var waveformChannel: SchnackWaveformChannel = .input
  private var displayLink: CADisplayLink?
  private var renderedSamples = Array(repeating: CGFloat.zero, count: 96)

  private var resolvedRenderStyle: SchnackWaveformRenderStyle {
    if let explicitStyle = SchnackWaveformRenderStyle(rawValue: renderStyle as String),
       explicitStyle != .automatic {
      return explicitStyle
    }

    return waveformChannel == .input ? .envelope : .waveform
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    configureView()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    configureView()
  }

  deinit {
    stopDisplayLink()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    baselineLayer.frame = bounds
    fillLayer.frame = bounds
    glowLayer.frame = bounds
    waveformLayer.frame = bounds
    redrawCurrentFrame()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    updateDisplayLinkState()
  }

  private func configureView() {
    isOpaque = false
    backgroundColor = .clear
    isUserInteractionEnabled = false

    baselineLayer.fillColor = UIColor.clear.cgColor
    fillLayer.fillColor = UIColor.clear.cgColor
    glowLayer.fillColor = UIColor.clear.cgColor
    waveformLayer.fillColor = UIColor.clear.cgColor

    baselineLayer.contentsScale = displayScale
    fillLayer.contentsScale = displayScale
    glowLayer.contentsScale = displayScale
    waveformLayer.contentsScale = displayScale

    fillLayer.lineCap = .round
    fillLayer.lineJoin = .round
    glowLayer.lineCap = .round
    glowLayer.lineJoin = .round
    waveformLayer.lineCap = .round
    waveformLayer.lineJoin = .round
    fillLayer.allowsEdgeAntialiasing = true
    glowLayer.allowsEdgeAntialiasing = true
    waveformLayer.allowsEdgeAntialiasing = true

    layer.addSublayer(baselineLayer)
    layer.addSublayer(fillLayer)
    layer.addSublayer(glowLayer)
    layer.addSublayer(waveformLayer)

    updateLayerAppearance()
  }

  private func updateLayerAppearance() {
    let requestedLineWidth = CGFloat(truncating: lineWidth)
    let resolvedLineWidth =
      resolvedRenderStyle == .waveform && waveformChannel == .output
        ? max(2.35, requestedLineWidth * 1.08)
        : max(2.2, requestedLineWidth)
    baselineLayer.strokeColor = baselineColor.cgColor
    baselineLayer.lineWidth = 0.9
    fillLayer.fillColor =
      resolvedRenderStyle == .waveform && waveformChannel == .output
        ? lineColor.withAlphaComponent(active ? 0.12 : 0.06).cgColor
        : lineColor.withAlphaComponent(active ? 0.05 : 0.024).cgColor
    glowLayer.strokeColor = UIColor.clear.cgColor
    glowLayer.lineWidth = 0
    waveformLayer.strokeColor = lineColor.cgColor
    waveformLayer.lineWidth = resolvedLineWidth
  }

  private func updateDisplayLinkState() {
    if window != nil && active {
      startDisplayLinkIfNeeded()
      return
    }

    stopDisplayLink()
  }

  private func startDisplayLinkIfNeeded() {
    guard displayLink == nil else {
      return
    }

    let link = CADisplayLink(target: self, selector: #selector(handleDisplayLink))
    if #available(iOS 15.0, *) {
      link.preferredFrameRateRange = CAFrameRateRange(
        minimum: 40,
        maximum: 120,
        preferred: 60
      )
    } else {
      link.preferredFramesPerSecond = 60
    }
    link.add(to: .main, forMode: .common)
    displayLink = link
  }

  private func stopDisplayLink() {
    displayLink?.invalidate()
    displayLink = nil
  }

  @objc private func handleDisplayLink() {
    guard bounds.width > 1, bounds.height > 1 else {
      return
    }

    let sourceSamples = SchnackWaveformCoordinator.shared.samples(for: waveformChannel)
    let visuallyTunedSamples =
      resolvedRenderStyle == .envelope
        ? tuneEnvelopeSamples(sourceSamples)
        : tuneOutputSamples(sourceSamples)
    let pointCount =
      resolvedRenderStyle == .waveform
        ? max(32, min(92, Int(bounds.width / 3.2)))
        : max(28, min(82, Int(bounds.width / 3.6)))
    let spatiallySmoothed = smoothSpatialSamples(
      resample(samples: visuallyTunedSamples, count: pointCount),
      channel: waveformChannel
    )

    if renderedSamples.count != spatiallySmoothed.count {
      renderedSamples = spatiallySmoothed
    } else {
      let previousWeight: CGFloat = waveformChannel == .output ? 0.42 : 0.34
      let nextWeight: CGFloat = 1 - previousWeight
      renderedSamples = zip(renderedSamples, spatiallySmoothed).map {
        $0 * previousWeight + $1 * nextWeight
      }
    }

    redrawCurrentFrame()
  }

  private func redrawCurrentFrame() {
    guard bounds.width > 1, bounds.height > 1 else {
      return
    }

    baselineLayer.path = buildBaselinePath().cgPath
    if resolvedRenderStyle == .envelope {
      let inputLinePath = buildEnvelopeLinePath(from: renderedSamples)
      glowLayer.path = nil
      waveformLayer.path = inputLinePath.cgPath
      fillLayer.path =
        active
          ? buildEnvelopeFillPath(from: renderedSamples).cgPath
          : nil
      return
    }

    let waveformPath = buildWaveformPath(
      from: renderedSamples,
      snapsToPixels: false
    )
    glowLayer.path = waveformPath.cgPath
    waveformLayer.path = waveformPath.cgPath
    fillLayer.path =
      active
        ? buildWaveformFillPath(from: renderedSamples).cgPath
        : nil
  }

  private func buildBaselinePath() -> UIBezierPath {
    let path = UIBezierPath()
    let midY = snap(bounds.midY)
    path.move(to: CGPoint(x: 0, y: midY))
    path.addLine(to: CGPoint(x: bounds.width, y: midY))
    return path
  }

  private func buildWaveformPath(
    from samples: [CGFloat],
    snapsToPixels: Bool
  ) -> UIBezierPath {
    let path = UIBezierPath()
    guard !samples.isEmpty else {
      return buildBaselinePath()
    }

    let midY = bounds.midY
    let amplitude =
      waveformChannel == .output
        ? max(8, bounds.height * 0.42)
        : max(7, bounds.height * 0.47)
    let points: [CGPoint] = samples.enumerated().map { index, sample in
      let x = CGFloat(index) * max(1, bounds.width) / CGFloat(max(1, samples.count - 1))
      let y = midY - sample * amplitude
      return CGPoint(
        x: snapsToPixels ? snap(x) : x,
        y: snapsToPixels ? snap(y) : y
      )
    }

    guard let firstPoint = points.first else {
      return buildBaselinePath()
    }

    path.move(to: firstPoint)

    if points.count == 1 {
      path.addLine(to: firstPoint)
      return path
    }

    for index in 1..<(points.count - 1) {
      let current = points[index]
      let next = points[index + 1]
      let midpointX = (current.x + next.x) * 0.5
      let midpointY = (current.y + next.y) * 0.5
      let midPoint = CGPoint(
        x: snapsToPixels ? snap(midpointX) : midpointX,
        y: snapsToPixels ? snap(midpointY) : midpointY
      )
      path.addQuadCurve(to: midPoint, controlPoint: current)
    }

    if let penultimatePoint = points.dropLast().last,
       let lastPoint = points.last {
      path.addQuadCurve(to: lastPoint, controlPoint: penultimatePoint)
    }

    return path
  }

  private func buildWaveformFillPath(from samples: [CGFloat]) -> UIBezierPath {
    let path = buildWaveformPath(from: samples, snapsToPixels: false)
    let midY = bounds.midY

    path.addLine(to: CGPoint(x: bounds.width, y: midY))
    path.addLine(to: CGPoint(x: 0, y: midY))
    path.close()
    return path
  }

  private func buildEnvelopeLinePath(from samples: [CGFloat]) -> UIBezierPath {
    let path = UIBezierPath()
    guard !samples.isEmpty else {
      return buildBaselinePath()
    }

    let midY = bounds.midY
    let amplitude = max(10, bounds.height * 0.31)
    let points: [CGPoint] = samples.enumerated().map { index, sample in
      let x = CGFloat(index) * max(1, bounds.width) / CGFloat(max(1, samples.count - 1))
      let y = midY - sample * amplitude
      return CGPoint(x: x, y: y)
    }

    guard let firstPoint = points.first else {
      return buildBaselinePath()
    }

    path.move(to: firstPoint)

    if points.count == 1 {
      path.addLine(to: firstPoint)
      return path
    }

    for index in 1..<(points.count - 1) {
      let current = points[index]
      let next = points[index + 1]
      let midPoint = CGPoint(
        x: (current.x + next.x) * 0.5,
        y: (current.y + next.y) * 0.5
      )
      path.addQuadCurve(to: midPoint, controlPoint: current)
    }

    if let penultimatePoint = points.dropLast().last,
       let lastPoint = points.last {
      path.addQuadCurve(to: lastPoint, controlPoint: penultimatePoint)
    }

    return path
  }

  private func buildEnvelopeFillPath(from samples: [CGFloat]) -> UIBezierPath {
    let path = buildEnvelopeLinePath(from: samples)
    guard !samples.isEmpty else {
      return path
    }

    let midY = bounds.midY
    let amplitude = max(10, bounds.height * 0.31)
    let reversedPoints: [CGPoint] = samples.enumerated().reversed().map { index, sample in
      let x = CGFloat(index) * max(1, bounds.width) / CGFloat(max(1, samples.count - 1))
      let y = midY + sample * amplitude * 0.82
      return CGPoint(x: x, y: y)
    }

    reversedPoints.forEach { point in
      path.addLine(to: point)
    }
    path.close()
    return path
  }

  private func resample(samples: [CGFloat], count: Int) -> [CGFloat] {
    guard count > 0 else {
      return []
    }

    guard !samples.isEmpty else {
      return Array(repeating: .zero, count: count)
    }

    if samples.count == count {
      return samples
    }

    return (0..<count).map { index in
      let position = CGFloat(index) / CGFloat(max(1, count - 1)) * CGFloat(samples.count - 1)
      let leftIndex = Int(floor(position))
      let rightIndex = min(samples.count - 1, leftIndex + 1)
      let blend = position - CGFloat(leftIndex)

      return (samples[leftIndex] * (1 - blend)) + (samples[rightIndex] * blend)
    }
  }

  private func smoothSpatialSamples(
    _ samples: [CGFloat],
    channel: SchnackWaveformChannel
  ) -> [CGFloat] {
    guard samples.count > 2 else {
      return samples
    }

    let firstPass = samples.enumerated().map { index, sample in
      let previous = samples[index - 1 >= 0 ? index - 1 : index]
      let next = samples[index + 1 < samples.count ? index + 1 : index]
      return
        channel == .output
          ? previous * 0.18 + sample * 0.64 + next * 0.18
          : previous * 0.24 + sample * 0.52 + next * 0.24
    }

    let secondPass = firstPass.enumerated().map { index, sample in
      let previous = firstPass[index - 1 >= 0 ? index - 1 : index]
      let next = firstPass[index + 1 < firstPass.count ? index + 1 : index]
      return
        channel == .output
          ? previous * 0.12 + sample * 0.76 + next * 0.12
          : previous * 0.2 + sample * 0.6 + next * 0.2
    }

    guard channel == .input else {
      return secondPass
    }

    return secondPass.enumerated().map { index, sample in
      let previous = secondPass[index - 1 >= 0 ? index - 1 : index]
      let next = secondPass[index + 1 < secondPass.count ? index + 1 : index]
      return previous * 0.18 + sample * 0.64 + next * 0.18
    }
  }

  private func tuneOutputSamples(_ samples: [CGFloat]) -> [CGFloat] {
    guard !samples.isEmpty else {
      return samples
    }

    let softlySmoothed = samples.enumerated().map { index, sample in
      let previous = samples[index - 1 >= 0 ? index - 1 : index]
      let next = samples[index + 1 < samples.count ? index + 1 : index]
      return previous * 0.24 + sample * 0.52 + next * 0.24
    }

    return softlySmoothed.map { sample in
      let magnitude = abs(sample)
      guard magnitude >= 0.001 else {
        return 0
      }

      let direction: CGFloat = sample >= 0 ? 1 : -1
      let shapedMagnitude = pow(magnitude, 0.92)
      return min(1, max(-1, direction * shapedMagnitude))
    }
  }

  private func tuneEnvelopeSamples(_ samples: [CGFloat]) -> [CGFloat] {
    guard !samples.isEmpty else {
      return samples
    }

    let shapedMagnitudes = samples.map { sample -> CGFloat in
      let magnitude = abs(sample)
      guard magnitude >= 0.01 else {
        return .zero
      }

      return min(1, pow(magnitude, 0.8) * 1.2 + magnitude * 0.28)
    }

    let firstPass = shapedMagnitudes.enumerated().map { index, sample in
      let previous = shapedMagnitudes[index - 1 >= 0 ? index - 1 : index]
      let next = shapedMagnitudes[index + 1 < shapedMagnitudes.count ? index + 1 : index]
      return previous * 0.24 + sample * 0.52 + next * 0.24
    }

    let secondPass = firstPass.enumerated().map { index, sample in
      let previous = firstPass[index - 1 >= 0 ? index - 1 : index]
      let next = firstPass[index + 1 < firstPass.count ? index + 1 : index]
      return previous * 0.2 + sample * 0.6 + next * 0.2
    }

    return secondPass.enumerated().map { index, sample in
      let previous = secondPass[index - 1 >= 0 ? index - 1 : index]
      let next = secondPass[index + 1 < secondPass.count ? index + 1 : index]
      return previous * 0.16 + sample * 0.68 + next * 0.16
    }
  }

  private func snap(_ value: CGFloat) -> CGFloat {
    round(value * displayScale) / displayScale
  }
}

@objc(SchnackNativeWaveformView)
final class SchnackNativeWaveformViewManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func view() -> UIView! {
    SchnackWaveformView()
  }
}
