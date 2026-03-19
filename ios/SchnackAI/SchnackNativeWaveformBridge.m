#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(SchnackNativeWaveform, RCTEventEmitter)

RCT_EXTERN_METHOD(startRecording:(NSString *)sessionId
                  outputUri:(NSString * _Nullable)outputUri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopRecording:(NSString *)sessionId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(cancelRecording:(NSString *)sessionId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(analyzeAudioFile:(NSString *)uri
                  sampleCount:(NSNumber * _Nullable)sampleCount
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

@interface RCT_EXTERN_MODULE(SchnackNativeWaveformView, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(channel, NSString)
RCT_EXPORT_VIEW_PROPERTY(active, BOOL)
RCT_EXPORT_VIEW_PROPERTY(lineColor, UIColor)
RCT_EXPORT_VIEW_PROPERTY(baselineColor, UIColor)
RCT_EXPORT_VIEW_PROPERTY(lineWidth, NSNumber)

@end
