import UIKit
import React

enum SchnackWaveformChannel: String {
  case input
  case output
}

final class SchnackWaveformCoordinator {
  static let shared = SchnackWaveformCoordinator()

  private let stateLock = NSLock()
  private let defaultSampleCount = 192
  private var samplesByChannel: [SchnackWaveformChannel: [CGFloat]]

  private init() {
    let emptySamples = Array(repeating: CGFloat.zero, count: defaultSampleCount)
    samplesByChannel = [
      .input: emptySamples,
      .output: emptySamples,
    ]
  }

  func setSamples(channel: SchnackWaveformChannel, samples: [Float]) {
    let normalizedSamples = samples.map { sample in
      CGFloat(min(1, max(-1, sample)))
    }

    stateLock.lock()
    samplesByChannel[channel] = normalizedSamples
    stateLock.unlock()
  }

  func setSamples(channel: SchnackWaveformChannel, samples: [Double]) {
    let normalizedSamples = samples.map { sample in
      CGFloat(min(1, max(-1, sample)))
    }

    stateLock.lock()
    samplesByChannel[channel] = normalizedSamples
    stateLock.unlock()
  }

  func clear(channel: SchnackWaveformChannel) {
    stateLock.lock()
    let count = max(defaultSampleCount, samplesByChannel[channel]?.count ?? defaultSampleCount)
    samplesByChannel[channel] = Array(repeating: CGFloat.zero, count: count)
    stateLock.unlock()
  }

  func samples(for channel: SchnackWaveformChannel) -> [CGFloat] {
    stateLock.lock()
    let samples =
      samplesByChannel[channel] ??
      Array(repeating: CGFloat.zero, count: defaultSampleCount)
    stateLock.unlock()
    return samples
  }
}

final class SchnackWaveformView: UIView {
  private static let inputReferenceFloor: CGFloat = 0.11

  @objc var channel: NSString = SchnackWaveformChannel.input.rawValue as NSString {
    didSet {
      waveformChannel =
        SchnackWaveformChannel(rawValue: channel as String) ?? .input
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
  private let glowLayer = CAShapeLayer()
  private let waveformLayer = CAShapeLayer()
  private let displayScale = UIScreen.main.scale
  private var waveformChannel: SchnackWaveformChannel = .input
  private var displayLink: CADisplayLink?
  private var renderedSamples = Array(repeating: CGFloat.zero, count: 96)
  private var inputReferenceLevel = SchnackWaveformView.inputReferenceFloor

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
    glowLayer.fillColor = UIColor.clear.cgColor
    waveformLayer.fillColor = UIColor.clear.cgColor

    baselineLayer.contentsScale = displayScale
    glowLayer.contentsScale = displayScale
    waveformLayer.contentsScale = displayScale

    glowLayer.lineCap = .round
    glowLayer.lineJoin = .round
    waveformLayer.lineCap = .round
    waveformLayer.lineJoin = .round
    glowLayer.allowsEdgeAntialiasing = true
    waveformLayer.allowsEdgeAntialiasing = true

    layer.addSublayer(baselineLayer)
    layer.addSublayer(glowLayer)
    layer.addSublayer(waveformLayer)

    updateLayerAppearance()
  }

  private func updateLayerAppearance() {
    let resolvedLineWidth = max(2.2, CGFloat(truncating: lineWidth))
    baselineLayer.strokeColor = baselineColor.cgColor
    baselineLayer.lineWidth = 0.9
    glowLayer.strokeColor = lineColor.withAlphaComponent(active ? 0.08 : 0.04).cgColor
    glowLayer.lineWidth = resolvedLineWidth * 1.28
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
      waveformChannel == .input
        ? tuneInputSamples(sourceSamples)
        : sourceSamples
    let pointCount = max(40, min(132, Int(bounds.width / 2.35)))
    let spatiallySmoothed = smoothSpatialSamples(
      resample(samples: visuallyTunedSamples, count: pointCount)
    )

    if renderedSamples.count != spatiallySmoothed.count {
      renderedSamples = spatiallySmoothed
    } else {
      renderedSamples = zip(renderedSamples, spatiallySmoothed).map {
        $0 * 0.24 + $1 * 0.76
      }
    }

    redrawCurrentFrame()
  }

  private func redrawCurrentFrame() {
    guard bounds.width > 1, bounds.height > 1 else {
      return
    }

    baselineLayer.path = buildBaselinePath().cgPath
    let waveformPath = buildWaveformPath(from: renderedSamples)
    glowLayer.path = waveformPath.cgPath
    waveformLayer.path = waveformPath.cgPath
  }

  private func buildBaselinePath() -> UIBezierPath {
    let path = UIBezierPath()
    let midY = snap(bounds.midY)
    path.move(to: CGPoint(x: 0, y: midY))
    path.addLine(to: CGPoint(x: bounds.width, y: midY))
    return path
  }

  private func buildWaveformPath(from samples: [CGFloat]) -> UIBezierPath {
    let path = UIBezierPath()
    guard !samples.isEmpty else {
      return buildBaselinePath()
    }

    let midY = bounds.midY
    let amplitude = max(7, bounds.height * 0.47)
    let points = samples.enumerated().map { index, sample in
      CGPoint(
        x: snap(CGFloat(index) * max(1, bounds.width) / CGFloat(max(1, samples.count - 1))),
        y: snap(midY - sample * amplitude)
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
      let midPoint = CGPoint(
        x: snap((current.x + next.x) * 0.5),
        y: snap((current.y + next.y) * 0.5)
      )
      path.addQuadCurve(to: midPoint, controlPoint: current)
    }

    if let penultimatePoint = points.dropLast().last,
       let lastPoint = points.last {
      path.addQuadCurve(to: lastPoint, controlPoint: penultimatePoint)
    }

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

  private func smoothSpatialSamples(_ samples: [CGFloat]) -> [CGFloat] {
    guard samples.count > 2 else {
      return samples
    }

    let firstPass = samples.enumerated().map { index, sample in
      let previous = samples[index - 1 >= 0 ? index - 1 : index]
      let next = samples[index + 1 < samples.count ? index + 1 : index]
      return previous * 0.18 + sample * 0.64 + next * 0.18
    }

    return firstPass.enumerated().map { index, sample in
      let previous = firstPass[index - 1 >= 0 ? index - 1 : index]
      let next = firstPass[index + 1 < firstPass.count ? index + 1 : index]
      return previous * 0.12 + sample * 0.76 + next * 0.12
    }
  }

  private func tuneInputSamples(_ samples: [CGFloat]) -> [CGFloat] {
    guard !samples.isEmpty else {
      inputReferenceLevel = SchnackWaveformView.inputReferenceFloor
      return samples
    }

    let peak = samples.reduce(CGFloat.zero) { currentPeak, sample in
      max(currentPeak, abs(sample))
    }
    let averageMagnitude =
      samples.reduce(CGFloat.zero) { partialResult, sample in
        partialResult + abs(sample)
      } / CGFloat(max(1, samples.count))

    let isNearSilence = peak < 0.012 && averageMagnitude < 0.004
    let detectedLevel = isNearSilence ? 0 : max(peak, averageMagnitude * 2.8)

    if isNearSilence {
      inputReferenceLevel = max(
        SchnackWaveformView.inputReferenceFloor,
        inputReferenceLevel * 0.9
      )
    } else if detectedLevel > inputReferenceLevel {
      inputReferenceLevel = detectedLevel
    } else {
      inputReferenceLevel = max(
        SchnackWaveformView.inputReferenceFloor,
        inputReferenceLevel * 0.82 + detectedLevel * 0.18
      )
    }

    let gain = isNearSilence
      ? 1
      : min(
          12,
          max(
            2.2,
            0.96 / max(SchnackWaveformView.inputReferenceFloor, inputReferenceLevel)
          )
        )

    return samples.map { sample in
      let magnitude = abs(sample)
      guard magnitude >= 0.0024 else {
        return 0
      }

      let direction: CGFloat = sample >= 0 ? 1 : -1
      let shapedMagnitude = pow(magnitude, 0.84)
      return min(1, max(-1, direction * shapedMagnitude * gain))
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
