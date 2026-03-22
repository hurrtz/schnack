import AVFoundation
import Foundation
import React

@objc(SchnackNativeWaveform)
final class SchnackNativeWaveform: RCTEventEmitter {
  private static let eventName = "SchnackNativeWaveformEvent"
  private var hasListeners = false
  private lazy var recorder: SchnackWaveformRecorder = {
    let recorder = SchnackWaveformRecorder()
    recorder.onEvent = { [weak self] body in
      self?.emitEvent(body)
    }
    return recorder
  }()

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

      do {
        let outputURL = try self.resolveOutputURL(from: outputUri)
        let recording = try self.recorder.startRecording(
          sessionId: sessionId,
          outputURL: outputURL
        )
        resolve(["uri": recording.absoluteString])
      } catch {
        self.recorder.cleanup()
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
        let outputURL = try self.recorder.stopRecording(sessionId: sessionId)
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
        try self.recorder.cancelRecording(sessionId: sessionId)
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
        resolve(
          try SchnackWaveformFileAnalyzer.analyzeAudioFile(
            at: url,
            sampleCount: targetCount
          )
        )
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
      self.recorder.cleanup()
      SchnackWaveformCoordinator.shared.clear(channel: .output)
    }
  }

  private func emitEvent(_ body: [String: Any]) {
    guard hasListeners else {
      return
    }

    sendEvent(withName: Self.eventName, body: body)
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
