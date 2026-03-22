import UIKit
import React

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
        ? SchnackWaveformRendering.tuneEnvelopeSamples(sourceSamples)
        : SchnackWaveformRendering.tuneOutputSamples(sourceSamples)
    let pointCount =
      resolvedRenderStyle == .waveform
        ? max(32, min(92, Int(bounds.width / 3.2)))
        : max(28, min(82, Int(bounds.width / 3.6)))
    let spatiallySmoothed = SchnackWaveformRendering.smoothSpatialSamples(
      SchnackWaveformRendering.resample(samples: visuallyTunedSamples, count: pointCount),
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

    baselineLayer.path =
      SchnackWaveformRendering.buildBaselinePath(
        bounds: bounds,
        displayScale: displayScale
      ).cgPath

    if resolvedRenderStyle == .envelope {
      let inputLinePath = SchnackWaveformRendering.buildEnvelopeLinePath(
        bounds: bounds,
        samples: renderedSamples
      )
      glowLayer.path = nil
      waveformLayer.path = inputLinePath.cgPath
      fillLayer.path =
        active
          ? SchnackWaveformRendering.buildEnvelopeFillPath(
              bounds: bounds,
              samples: renderedSamples
            ).cgPath
          : nil
      return
    }

    let waveformPath = SchnackWaveformRendering.buildWaveformPath(
      bounds: bounds,
      samples: renderedSamples,
      channel: waveformChannel,
      displayScale: displayScale,
      snapsToPixels: false
    )
    glowLayer.path = waveformPath.cgPath
    waveformLayer.path = waveformPath.cgPath
    fillLayer.path =
      active
        ? SchnackWaveformRendering.buildWaveformFillPath(
            bounds: bounds,
            samples: renderedSamples,
            channel: waveformChannel,
            displayScale: displayScale
          ).cgPath
        : nil
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
