import UIKit

enum SchnackWaveformRendering {
  static func buildBaselinePath(bounds: CGRect, displayScale: CGFloat) -> UIBezierPath {
    let path = UIBezierPath()
    let midY = snap(bounds.midY, displayScale: displayScale)
    path.move(to: CGPoint(x: 0, y: midY))
    path.addLine(to: CGPoint(x: bounds.width, y: midY))
    return path
  }

  static func buildWaveformPath(
    bounds: CGRect,
    samples: [CGFloat],
    channel: SchnackWaveformChannel,
    displayScale: CGFloat,
    snapsToPixels: Bool
  ) -> UIBezierPath {
    let path = UIBezierPath()
    guard !samples.isEmpty else {
      return buildBaselinePath(bounds: bounds, displayScale: displayScale)
    }

    let midY = bounds.midY
    let amplitude =
      channel == .output
        ? max(8, bounds.height * 0.42)
        : max(7, bounds.height * 0.47)
    let points: [CGPoint] = samples.enumerated().map { index, sample in
      let x = CGFloat(index) * max(1, bounds.width) / CGFloat(max(1, samples.count - 1))
      let y = midY - sample * amplitude
      return CGPoint(
        x: snapsToPixels ? snap(x, displayScale: displayScale) : x,
        y: snapsToPixels ? snap(y, displayScale: displayScale) : y
      )
    }

    guard let firstPoint = points.first else {
      return buildBaselinePath(bounds: bounds, displayScale: displayScale)
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
        x: snapsToPixels ? snap(midpointX, displayScale: displayScale) : midpointX,
        y: snapsToPixels ? snap(midpointY, displayScale: displayScale) : midpointY
      )
      path.addQuadCurve(to: midPoint, controlPoint: current)
    }

    if let penultimatePoint = points.dropLast().last,
       let lastPoint = points.last {
      path.addQuadCurve(to: lastPoint, controlPoint: penultimatePoint)
    }

    return path
  }

  static func buildWaveformFillPath(
    bounds: CGRect,
    samples: [CGFloat],
    channel: SchnackWaveformChannel,
    displayScale: CGFloat
  ) -> UIBezierPath {
    let path = buildWaveformPath(
      bounds: bounds,
      samples: samples,
      channel: channel,
      displayScale: displayScale,
      snapsToPixels: false
    )
    let midY = bounds.midY

    path.addLine(to: CGPoint(x: bounds.width, y: midY))
    path.addLine(to: CGPoint(x: 0, y: midY))
    path.close()
    return path
  }

  static func buildEnvelopeLinePath(bounds: CGRect, samples: [CGFloat]) -> UIBezierPath {
    let path = UIBezierPath()
    guard !samples.isEmpty else {
      return buildBaselinePath(bounds: bounds, displayScale: UIScreen.main.scale)
    }

    let midY = bounds.midY
    let amplitude = max(10, bounds.height * 0.31)
    let points: [CGPoint] = samples.enumerated().map { index, sample in
      let x = CGFloat(index) * max(1, bounds.width) / CGFloat(max(1, samples.count - 1))
      let y = midY - sample * amplitude
      return CGPoint(x: x, y: y)
    }

    guard let firstPoint = points.first else {
      return buildBaselinePath(bounds: bounds, displayScale: UIScreen.main.scale)
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

  static func buildEnvelopeFillPath(bounds: CGRect, samples: [CGFloat]) -> UIBezierPath {
    let path = buildEnvelopeLinePath(bounds: bounds, samples: samples)
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

  static func resample(samples: [CGFloat], count: Int) -> [CGFloat] {
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

  static func smoothSpatialSamples(
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

  static func tuneOutputSamples(_ samples: [CGFloat]) -> [CGFloat] {
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

  static func tuneEnvelopeSamples(_ samples: [CGFloat]) -> [CGFloat] {
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

  static func snap(_ value: CGFloat, displayScale: CGFloat) -> CGFloat {
    round(value * displayScale) / displayScale
  }
}
