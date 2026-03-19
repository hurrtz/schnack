import AVFoundation
import Foundation
import React

@objc(SchnackNativeWaveform)
final class SchnackNativeWaveform: RCTEventEmitter {
  private static let eventName = "SchnackNativeWaveformEvent"
  private static let rollingSampleCount = 192
  private static let inputSampleChunkCount = 16
  private static let inputTapBufferSize: AVAudioFrameCount = 512
  private static let emitIntervalMs = 16

  private let stateLock = NSLock()
  private var hasListeners = false
  private var audioEngine: AVAudioEngine?
  private var audioFile: AVAudioFile?
  private var activeSessionId: String?
  private var outputURL: URL?
  private var emitTimer: DispatchSourceTimer?
  private var rollingSamples = Array(
    repeating: Float.zero,
    count: SchnackNativeWaveform.rollingSampleCount
  )
  private var rollingCursor = 0
  private var rollingFilled = false

  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func supportedEvents() -> [String]! {
    [Self.eventName]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  @objc(startRecording:outputUri:resolver:rejecter:)
  func startRecording(
    _ sessionId: String,
    outputUri: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      guard !sessionId.isEmpty else {
        reject("native_waveform_record_error", "sessionId is required.", nil)
        return
      }

      guard self.activeSessionId == nil else {
        reject(
          "native_waveform_record_error",
          "Another native waveform recording session is already active.",
          nil
        )
        return
      }

      do {
        let outputURL = try self.resolveOutputURL(from: outputUri)
        try FileManager.default.createDirectory(
          at: outputURL.deletingLastPathComponent(),
          withIntermediateDirectories: true
        )

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
          .playAndRecord,
          mode: .measurement,
          options: [.defaultToSpeaker, .allowBluetoothHFP]
        )
        try session.setActive(true)

        let engine = AVAudioEngine()
        let inputNode = engine.inputNode
        let inputFormat = inputNode.inputFormat(forBus: 0)

        guard inputFormat.channelCount > 0 else {
          reject(
            "native_waveform_record_error",
            "No microphone input channels are available.",
            nil
          )
          return
        }

        let fileSettings: [String: Any] = [
          AVFormatIDKey: kAudioFormatLinearPCM,
          AVSampleRateKey: inputFormat.sampleRate,
          AVNumberOfChannelsKey: inputFormat.channelCount,
          AVLinearPCMBitDepthKey: 32,
          AVLinearPCMIsFloatKey: true,
          AVLinearPCMIsBigEndianKey: false,
          AVLinearPCMIsNonInterleaved: false,
        ]

        let file = try AVAudioFile(
          forWriting: outputURL,
          settings: fileSettings,
          commonFormat: .pcmFormatFloat32,
          interleaved: false
        )

        self.resetRollingSamples()

        inputNode.installTap(
          onBus: 0,
          bufferSize: Self.inputTapBufferSize,
          format: inputFormat
        ) { [weak self] buffer, _ in
          guard let self else {
            return
          }

          do {
            try file.write(from: buffer)
          } catch {
            self.emitEvent([
              "type": "error",
              "sessionId": sessionId,
              "message": error.localizedDescription,
            ])
          }

          self.appendRollingSamples(
            self.extractPeakSamples(
              from: buffer,
              targetCount: Self.inputSampleChunkCount
            )
          )
        }

        engine.prepare()
        try engine.start()

        self.audioEngine = engine
        self.audioFile = file
        self.activeSessionId = sessionId
        self.outputURL = outputURL
        self.startEmitTimer(for: sessionId)

        self.emitEvent([
          "type": "started",
          "sessionId": sessionId,
          "uri": outputURL.absoluteString,
        ])

        resolve(["uri": outputURL.absoluteString])
      } catch {
        self.cleanupRecording(deleteOutput: false)
        reject("native_waveform_record_error", error.localizedDescription, error)
      }
    }
  }

  @objc(stopRecording:resolver:rejecter:)
  func stopRecording(
    _ sessionId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      do {
        let outputURL = try self.finishRecording(sessionId: sessionId, deleteOutput: false)
        self.emitEvent([
          "type": "stopped",
          "sessionId": sessionId,
          "uri": outputURL.absoluteString,
        ])
        resolve(["uri": outputURL.absoluteString])
      } catch {
        reject("native_waveform_record_error", error.localizedDescription, error)
      }
    }
  }

  @objc(cancelRecording:resolver:rejecter:)
  func cancelRecording(
    _ sessionId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      do {
        _ = try self.finishRecording(sessionId: sessionId, deleteOutput: true)
        self.emitEvent([
          "type": "cancelled",
          "sessionId": sessionId,
        ])
        resolve(true)
      } catch {
        reject("native_waveform_record_error", error.localizedDescription, error)
      }
    }
  }

  @objc(analyzeAudioFile:sampleCount:resolver:rejecter:)
  func analyzeAudioFile(
    _ uri: String,
    sampleCount: NSNumber?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let targetCount = max(64, sampleCount?.intValue ?? 960)

    DispatchQueue.global(qos: .userInitiated).async {
      do {
        let url = try self.resolveExistingFileURL(from: uri)
        let audioFile = try AVAudioFile(forReading: url)
        let frameCapacity = AVAudioFrameCount(audioFile.length)

        guard frameCapacity > 0 else {
          resolve(["samples": [], "durationMs": 0])
          return
        }

        guard
          let buffer = AVAudioPCMBuffer(
            pcmFormat: audioFile.processingFormat,
            frameCapacity: frameCapacity
          )
        else {
          resolve(["samples": [], "durationMs": 0])
          return
        }

        try audioFile.read(into: buffer)

        let samples = self.extractPeakSamples(from: buffer, targetCount: targetCount)
        let durationMs =
          Double(audioFile.length) / audioFile.processingFormat.sampleRate * 1000

        resolve([
          "samples": samples.map(Double.init),
          "durationMs": durationMs,
        ])
      } catch {
        reject("native_waveform_analysis_error", error.localizedDescription, error)
      }
    }
  }

  override func invalidate() {
    super.invalidate()
    DispatchQueue.main.async {
      self.cleanupRecording(deleteOutput: false)
    }
  }

  private func finishRecording(sessionId: String, deleteOutput: Bool) throws -> URL {
    guard activeSessionId == sessionId else {
      throw NSError(
        domain: "SchnackNativeWaveform",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "The native waveform recorder is not active for this session."]
      )
    }

    guard let outputURL else {
      throw NSError(
        domain: "SchnackNativeWaveform",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "The native waveform recorder has no output file."]
      )
    }

    cleanupRecording(deleteOutput: deleteOutput)
    return outputURL
  }

  private func cleanupRecording(deleteOutput: Bool) {
    stopEmitTimer()

    if let inputNode = audioEngine?.inputNode {
      inputNode.removeTap(onBus: 0)
    }

    audioEngine?.stop()
    audioEngine = nil
    audioFile = nil
    activeSessionId = nil

    let outputURL = self.outputURL
    self.outputURL = nil

    resetRollingSamples()

    try? AVAudioSession.sharedInstance().setActive(
      false,
      options: [.notifyOthersOnDeactivation]
    )

    if deleteOutput, let outputURL {
      try? FileManager.default.removeItem(at: outputURL)
    }
  }

  private func startEmitTimer(for sessionId: String) {
    stopEmitTimer()

    let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.main)
    timer.schedule(
      deadline: .now(),
      repeating: .milliseconds(Self.emitIntervalMs)
    )
    timer.setEventHandler { [weak self] in
      guard let self else {
        return
      }

      let samples = self.snapshotRollingSamples()
      let averageMagnitude =
        samples.reduce(0.0) { partialResult, sample in
          partialResult + abs(sample)
        } / Double(max(1, samples.count))

      self.emitEvent([
        "type": "levels",
        "sessionId": sessionId,
        "samples": samples,
        "averageMagnitude": averageMagnitude,
      ])
    }
    emitTimer = timer
    timer.resume()
  }

  private func stopEmitTimer() {
    emitTimer?.setEventHandler {}
    emitTimer?.cancel()
    emitTimer = nil
  }

  private func emitEvent(_ body: [String: Any]) {
    guard hasListeners else {
      return
    }

    sendEvent(withName: Self.eventName, body: body)
  }

  private func resetRollingSamples() {
    stateLock.lock()
    rollingSamples = Array(
      repeating: Float.zero,
      count: Self.rollingSampleCount
    )
    rollingCursor = 0
    rollingFilled = false
    stateLock.unlock()

    SchnackWaveformCoordinator.shared.clear(channel: .input)
  }

  private func appendRollingSamples(_ samples: [Float]) {
    stateLock.lock()

    for sample in samples {
      rollingSamples[rollingCursor] = clampSample(sample)
      rollingCursor = (rollingCursor + 1) % rollingSamples.count
      if rollingCursor == 0 {
        rollingFilled = true
      }
    }

    let orderedSamples = orderedRollingSamplesLocked()
    stateLock.unlock()

    SchnackWaveformCoordinator.shared.setSamples(
      channel: .input,
      samples: orderedSamples
    )
  }

  private func snapshotRollingSamples() -> [Double] {
    stateLock.lock()
    let orderedSamples = orderedRollingSamplesLocked()
    stateLock.unlock()
    return orderedSamples.map(Double.init)
  }

  private func orderedRollingSamplesLocked() -> [Float] {
    if rollingFilled {
      return
        Array(rollingSamples[rollingCursor...]) +
        Array(rollingSamples[..<rollingCursor])
    }

    return
      Array(repeating: 0, count: rollingSamples.count - rollingCursor) +
      Array(rollingSamples[..<rollingCursor])
  }

  private func extractPeakSamples(
    from buffer: AVAudioPCMBuffer,
    targetCount: Int
  ) -> [Float] {
    let frameCount = Int(buffer.frameLength)
    guard frameCount > 0, targetCount > 0 else {
      return Array(repeating: 0, count: max(0, targetCount))
    }

    let channelCount = Int(buffer.format.channelCount)
    let chunkSize = max(1, frameCount / targetCount)

    return (0..<targetCount).map { index in
      let start = index * chunkSize
      let end =
        index == targetCount - 1
          ? frameCount
          : min(frameCount, start + chunkSize)

      var peakSample: Float = 0

      if start >= end {
        return peakSample
      }

      for frameIndex in start..<end {
        let sample =
          (0..<channelCount).reduce(Float.zero) { partialResult, channelIndex in
            partialResult + sampleValue(in: buffer, channel: channelIndex, frame: frameIndex)
          } / Float(max(1, channelCount))

        if abs(sample) > abs(peakSample) {
          peakSample = sample
        }
      }

      return clampSample(peakSample * 1.5)
    }
  }

  private func sampleValue(
    in buffer: AVAudioPCMBuffer,
    channel: Int,
    frame: Int
  ) -> Float {
    switch buffer.format.commonFormat {
    case .pcmFormatFloat32:
      return buffer.floatChannelData?[channel][frame] ?? 0
    case .pcmFormatFloat64:
      let audioBuffers = UnsafeMutableAudioBufferListPointer(buffer.mutableAudioBufferList)
      guard
        channel < audioBuffers.count,
        let data = audioBuffers[channel].mData?.assumingMemoryBound(to: Double.self)
      else {
        return 0
      }

      return Float(data[frame])
    case .pcmFormatInt16:
      return Float(buffer.int16ChannelData?[channel][frame] ?? 0) / Float(Int16.max)
    case .pcmFormatInt32:
      return Float(buffer.int32ChannelData?[channel][frame] ?? 0) / Float(Int32.max)
    default:
      return 0
    }
  }

  private func resolveOutputURL(from uri: String?) throws -> URL {
    if let uri, !uri.isEmpty {
      if let fileURL = URL(string: uri), fileURL.isFileURL {
        return fileURL
      }

      return URL(fileURLWithPath: uri)
    }

    let cachesDirectory = try FileManager.default.url(
      for: .cachesDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )

    return cachesDirectory.appendingPathComponent(
      "native-waveform-\(Date().timeIntervalSince1970).wav"
    )
  }

  private func resolveExistingFileURL(from uri: String) throws -> URL {
    let url: URL

    if let candidate = URL(string: uri), candidate.isFileURL {
      url = candidate
    } else {
      url = URL(fileURLWithPath: uri)
    }

    guard FileManager.default.fileExists(atPath: url.path) else {
      throw NSError(
        domain: "SchnackNativeWaveform",
        code: 3,
        userInfo: [NSLocalizedDescriptionKey: "The audio file could not be found for waveform analysis."]
      )
    }

    return url
  }

  private func clampSample(_ sample: Float) -> Float {
    min(1, max(-1, sample))
  }
}
