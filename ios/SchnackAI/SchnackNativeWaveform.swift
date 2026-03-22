import AVFoundation
import Foundation
import React

@objc(SchnackNativeWaveform)
final class SchnackNativeWaveform: RCTEventEmitter {
  private static let eventName = "SchnackNativeWaveformEvent"
  private static let rollingSampleCount = 192
  private static let inputSampleChunkCount = 6
  private static let inputTapBufferSize: AVAudioFrameCount = 256
  private static let emitIntervalMs = 33
  private static let inputReferenceFloor: Float = 0.11

  private let stateLock = NSLock()
  private let inputProcessor = SchnackWaveformInputProcessor(
    referenceFloor: SchnackNativeWaveform.inputReferenceFloor
  )
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
  private var pendingRecordingErrorSessionId: String?

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

  private func logDebug(_ event: String, payload: [String: Any] = [:]) {
    let body = NSMutableDictionary(dictionary: payload)
    body["event"] = event
    body["timestamp"] = ISO8601DateFormatter().string(from: Date())

    if let data = try? JSONSerialization.data(withJSONObject: body, options: []),
       let message = String(data: data, encoding: .utf8) {
      NSLog("[waveform-debug] %@", message)
      return
    }

    NSLog("[waveform-debug] %@", "{\"event\":\"\(event)\"}")
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
            self.handleRecordingWriteError(
              sessionId: sessionId,
              message: error.localizedDescription
            )
            return
          }

          self.appendRollingSamples(
            self.inputProcessor.extractEnvelopeSamples(
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

        let samples = SchnackWaveformAudioAnalysis.extractPeakSamples(
          from: buffer,
          targetCount: targetCount
        )
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

  @objc(startOutputPlayback:samples:durationMs:resolver:rejecter:)
  func startOutputPlayback(
    _ itemId: String,
    samples: [NSNumber],
    durationMs: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      guard !itemId.isEmpty else {
        reject("native_waveform_output_error", "itemId is required.", nil)
        return
      }

      let normalizedSamples = samples.map(\.doubleValue)
      self.logDebug(
        "native-output-playback-bridge-start",
        payload: [
          "itemId": itemId,
          "sampleCount": normalizedSamples.count,
          "durationMs": durationMs.doubleValue,
        ]
      )
      SchnackWaveformCoordinator.shared.startPlayback(
        channel: .output,
        itemId: itemId,
        samples: normalizedSamples,
        durationMs: durationMs.doubleValue
      )
      resolve(true)
    }
  }

  @objc(stopOutputPlayback:resolver:rejecter:)
  func stopOutputPlayback(
    _ itemId: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      self.logDebug(
        "native-output-playback-bridge-stop",
        payload: [
          "itemId": itemId ?? NSNull(),
        ]
      )
      SchnackWaveformCoordinator.shared.stopPlayback(channel: .output, itemId: itemId)
      resolve(true)
    }
  }

  override func invalidate() {
    super.invalidate()
    DispatchQueue.main.async {
      self.cleanupRecording(deleteOutput: false)
      SchnackWaveformCoordinator.shared.clear(channel: .output)
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
    pendingRecordingErrorSessionId = nil

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

  private func handleRecordingWriteError(sessionId: String, message: String) {
    stateLock.lock()
    let shouldHandleError =
      activeSessionId == sessionId &&
      pendingRecordingErrorSessionId != sessionId
    if shouldHandleError {
      pendingRecordingErrorSessionId = sessionId
    }
    stateLock.unlock()

    guard shouldHandleError else {
      return
    }

    DispatchQueue.main.async {
      guard self.activeSessionId == sessionId else {
        self.stateLock.lock()
        if self.pendingRecordingErrorSessionId == sessionId {
          self.pendingRecordingErrorSessionId = nil
        }
        self.stateLock.unlock()
        return
      }

      self.emitEvent([
        "type": "error",
        "sessionId": sessionId,
        "message": message,
      ])
      self.cleanupRecording(deleteOutput: true)
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

    inputProcessor.reset()
    SchnackWaveformCoordinator.shared.clear(channel: .input)
  }

  private func appendRollingSamples(_ samples: [Float]) {
    let shapedSamples = inputProcessor.shape(samples: samples)

    stateLock.lock()
    for sample in shapedSamples {
      rollingSamples[rollingCursor] = SchnackWaveformAudioAnalysis.clamp(sample: sample)
      rollingCursor = (rollingCursor + 1) % rollingSamples.count
      if rollingCursor == 0 {
        rollingFilled = true
      }
    }
    let orderedSamples = orderedRollingSamplesLocked()
    stateLock.unlock()

    SchnackWaveformCoordinator.shared.setSamples(
      channel: .input,
      samples: orderedSamples,
      appendedCount: shapedSamples.count
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
}
