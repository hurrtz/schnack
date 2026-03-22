import AVFoundation
import Foundation

final class SchnackWaveformRecorder {
  static let rollingSampleCount = 192
  private static let inputSampleChunkCount = 6
  private static let inputTapBufferSize: AVAudioFrameCount = 256
  private static let emitIntervalMs = 33
  private static let inputReferenceFloor: Float = 0.11

  var onEvent: (([String: Any]) -> Void)?

  private let stateLock = NSLock()
  private let inputProcessor = SchnackWaveformInputProcessor(
    referenceFloor: SchnackWaveformRecorder.inputReferenceFloor
  )
  private var audioEngine: AVAudioEngine?
  private var audioFile: AVAudioFile?
  private var activeSessionId: String?
  private var outputURL: URL?
  private var emitTimer: DispatchSourceTimer?
  private var rollingSamples = Array(
    repeating: Float.zero,
    count: SchnackWaveformRecorder.rollingSampleCount
  )
  private var rollingCursor = 0
  private var rollingFilled = false
  private var pendingRecordingErrorSessionId: String?

  func startRecording(
    sessionId: String,
    outputURL: URL
  ) throws -> URL {
    guard activeSessionId == nil else {
      throw NSError(
        domain: "SchnackNativeWaveform",
        code: 100,
        userInfo: [NSLocalizedDescriptionKey: "Another native waveform recording session is already active."]
      )
    }

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
      throw NSError(
        domain: "SchnackNativeWaveform",
        code: 101,
        userInfo: [NSLocalizedDescriptionKey: "No microphone input channels are available."]
      )
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

    resetRollingSamples()

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

    audioEngine = engine
    audioFile = file
    activeSessionId = sessionId
    self.outputURL = outputURL
    startEmitTimer(for: sessionId)

    emitEvent([
      "type": "started",
      "sessionId": sessionId,
      "uri": outputURL.absoluteString,
    ])

    return outputURL
  }

  func stopRecording(sessionId: String) throws -> URL {
    let outputURL = try finishRecording(sessionId: sessionId, deleteOutput: false)
    emitEvent([
      "type": "stopped",
      "sessionId": sessionId,
      "uri": outputURL.absoluteString,
    ])
    return outputURL
  }

  func cancelRecording(sessionId: String) throws {
    _ = try finishRecording(sessionId: sessionId, deleteOutput: true)
    emitEvent([
      "type": "cancelled",
      "sessionId": sessionId,
    ])
  }

  func cleanup() {
    cleanupRecording(deleteOutput: false)
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
    onEvent?(body)
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
}
