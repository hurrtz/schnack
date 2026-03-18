#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTLog.h>

#include <algorithm>
#include <fstream>
#include <memory>
#include <mutex>
#include <optional>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

#include "sherpa-onnx/c-api/cxx-api.h"

namespace {

struct SchnackLocalTtsState {
  std::optional<sherpa_onnx::cxx::OfflineTts> tts;
  std::string modelType;
};

static std::unordered_map<std::string, std::shared_ptr<SchnackLocalTtsState>> g_local_tts_instances;
static std::mutex g_local_tts_mutex;

static bool SaveWavFile(const std::vector<float> &samples,
                        int32_t sampleRate,
                        const std::string &filePath) {
  if (samples.empty() || sampleRate <= 0) {
    return false;
  }

  std::ofstream outfile(filePath, std::ios::binary);
  if (!outfile) {
    return false;
  }

  const int32_t numChannels = 1;
  const int32_t bitsPerSample = 16;
  const int32_t byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const int32_t blockAlign = numChannels * bitsPerSample / 8;
  const int32_t dataSize = static_cast<int32_t>(samples.size()) * bitsPerSample / 8;
  const int32_t chunkSize = 36 + dataSize;

  outfile.write("RIFF", 4);
  outfile.write(reinterpret_cast<const char *>(&chunkSize), 4);
  outfile.write("WAVE", 4);
  outfile.write("fmt ", 4);
  const int32_t subchunk1Size = 16;
  outfile.write(reinterpret_cast<const char *>(&subchunk1Size), 4);
  const int16_t audioFormat = 1;
  outfile.write(reinterpret_cast<const char *>(&audioFormat), 2);
  const int16_t numChannelsInt16 = static_cast<int16_t>(numChannels);
  outfile.write(reinterpret_cast<const char *>(&numChannelsInt16), 2);
  outfile.write(reinterpret_cast<const char *>(&sampleRate), 4);
  outfile.write(reinterpret_cast<const char *>(&byteRate), 4);
  const int16_t blockAlignInt16 = static_cast<int16_t>(blockAlign);
  outfile.write(reinterpret_cast<const char *>(&blockAlignInt16), 2);
  const int16_t bitsPerSampleInt16 = static_cast<int16_t>(bitsPerSample);
  outfile.write(reinterpret_cast<const char *>(&bitsPerSampleInt16), 2);
  outfile.write("data", 4);
  outfile.write(reinterpret_cast<const char *>(&dataSize), 4);

  for (float sample : samples) {
    float clamped = std::max(-1.0f, std::min(1.0f, sample));
    int16_t intSample = static_cast<int16_t>(clamped * 32767.0f);
    outfile.write(reinterpret_cast<const char *>(&intSample), sizeof(int16_t));
  }

  outfile.close();
  return true;
}

static bool FileExists(NSString *path) {
  return path != nil && [[NSFileManager defaultManager] fileExistsAtPath:path];
}

static NSString *JoinLexiconPaths(NSArray<NSString *> *paths) {
  NSMutableArray<NSString *> *existing = [NSMutableArray array];
  for (NSString *path in paths) {
    if ([path isKindOfClass:[NSString class]] && FileExists(path)) {
      [existing addObject:path];
    }
  }

  return [existing componentsJoinedByString:@","];
}

}  // namespace

@interface SchnackNativeLocalTts : NSObject <RCTBridgeModule>
@end

@implementation SchnackNativeLocalTts

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0);
}

RCT_REMAP_METHOD(initialize,
                 initializeInstance:(NSString *)instanceId
                 config:(NSDictionary *)config
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (instanceId.length == 0) {
    reject(@"local_tts_init_error", @"instanceId is required.", nil);
    return;
  }

  NSString *modelType = config[@"modelType"];
  NSString *modelPath = config[@"modelPath"];
  NSString *tokensPath = config[@"tokensPath"];
  NSString *dataDirPath = config[@"dataDirPath"];
  NSNumber *numThreads = config[@"numThreads"];
  NSNumber *debug = config[@"debug"];
  NSString *provider = config[@"provider"];

  if (modelType.length == 0 || modelPath.length == 0 || tokensPath.length == 0 || dataDirPath.length == 0) {
    reject(@"local_tts_init_error",
           @"modelType, modelPath, tokensPath, and dataDirPath are required.",
           nil);
    return;
  }

  if (!FileExists(modelPath) || !FileExists(tokensPath) || !FileExists(dataDirPath)) {
    reject(@"local_tts_init_error",
           @"One or more local TTS model files are missing.",
           nil);
    return;
  }

  @try {
    sherpa_onnx::cxx::OfflineTtsConfig nativeConfig;
    nativeConfig.model.num_threads = numThreads != nil ? numThreads.intValue : 2;
    nativeConfig.model.debug = debug != nil ? debug.boolValue : false;
    nativeConfig.model.provider = provider.length > 0 ? std::string(provider.UTF8String) : "cpu";

    std::string modelTypeValue(modelType.UTF8String);
    if (modelTypeValue == "vits") {
      nativeConfig.model.vits.model = std::string(modelPath.UTF8String);
      nativeConfig.model.vits.tokens = std::string(tokensPath.UTF8String);
      nativeConfig.model.vits.data_dir = std::string(dataDirPath.UTF8String);

      NSString *lexiconPath = config[@"lexiconPath"];
      if (FileExists(lexiconPath)) {
        nativeConfig.model.vits.lexicon = std::string(lexiconPath.UTF8String);
      }

      NSNumber *noiseScale = config[@"noiseScale"];
      NSNumber *noiseScaleW = config[@"noiseScaleW"];
      NSNumber *lengthScale = config[@"lengthScale"];
      if (noiseScale != nil) {
        nativeConfig.model.vits.noise_scale = noiseScale.floatValue;
      }
      if (noiseScaleW != nil) {
        nativeConfig.model.vits.noise_scale_w = noiseScaleW.floatValue;
      }
      if (lengthScale != nil) {
        nativeConfig.model.vits.length_scale = lengthScale.floatValue;
      }
    } else if (modelTypeValue == "kokoro") {
      NSString *voicesPath = config[@"voicesPath"];
      if (!FileExists(voicesPath)) {
        reject(@"local_tts_init_error",
               @"The Kokoro voices file is missing.",
               nil);
        return;
      }

      nativeConfig.model.kokoro.model = std::string(modelPath.UTF8String);
      nativeConfig.model.kokoro.tokens = std::string(tokensPath.UTF8String);
      nativeConfig.model.kokoro.data_dir = std::string(dataDirPath.UTF8String);
      nativeConfig.model.kokoro.voices = std::string(voicesPath.UTF8String);

      NSArray<NSString *> *lexiconPaths = config[@"lexiconPaths"];
      NSString *joinedLexiconPaths = JoinLexiconPaths(lexiconPaths ?: @[]);
      if (joinedLexiconPaths.length > 0) {
        nativeConfig.model.kokoro.lexicon = std::string(joinedLexiconPaths.UTF8String);
      }

      NSString *lang = config[@"lang"];
      if (lang.length > 0) {
        nativeConfig.model.kokoro.lang = std::string(lang.UTF8String);
      }

      NSNumber *lengthScale = config[@"lengthScale"];
      if (lengthScale != nil) {
        nativeConfig.model.kokoro.length_scale = lengthScale.floatValue;
      }
    } else {
      reject(@"local_tts_init_error",
             [NSString stringWithFormat:@"Unsupported model type: %@", modelType],
             nil);
      return;
    }

    NSString *ruleFsts = config[@"ruleFsts"];
    if (ruleFsts.length > 0) {
      nativeConfig.rule_fsts = std::string(ruleFsts.UTF8String);
    }
    NSString *ruleFars = config[@"ruleFars"];
    if (ruleFars.length > 0) {
      nativeConfig.rule_fars = std::string(ruleFars.UTF8String);
    }
    NSNumber *maxNumSentences = config[@"maxNumSentences"];
    if (maxNumSentences != nil && maxNumSentences.intValue >= 1) {
      nativeConfig.max_num_sentences = maxNumSentences.intValue;
    }
    NSNumber *silenceScale = config[@"silenceScale"];
    if (silenceScale != nil) {
      nativeConfig.silence_scale = silenceScale.floatValue;
    }

    RCTLogInfo(@"[SchnackNativeLocalTts] initialize instance=%@ modelType=%@ model=%@ tokens=%@ dataDir=%@",
               instanceId,
               modelType,
               modelPath,
               tokensPath,
               dataDirPath);

    auto state = std::make_shared<SchnackLocalTtsState>();
    state->modelType = modelTypeValue;
    state->tts = sherpa_onnx::cxx::OfflineTts::Create(nativeConfig);

    std::lock_guard<std::mutex> lock(g_local_tts_mutex);
    g_local_tts_instances[std::string(instanceId.UTF8String)] = state;

    resolve(@YES);
  } @catch (NSException *exception) {
    reject(@"local_tts_init_error", exception.reason, nil);
  } catch (const std::exception &exception) {
    reject(@"local_tts_init_error",
           [NSString stringWithUTF8String:exception.what()],
           nil);
  } catch (...) {
    reject(@"local_tts_init_error",
           @"Unknown local TTS initialization error.",
           nil);
  }
}

RCT_REMAP_METHOD(generateToFile,
                 generateToFileForInstance:(NSString *)instanceId
                 text:(NSString *)text
                 speakerId:(double)speakerId
                 speed:(double)speed
                 outputPath:(NSString *)outputPath
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (instanceId.length == 0 || text.length == 0) {
    reject(@"local_tts_generate_error", @"instanceId and text are required.", nil);
    return;
  }

  std::shared_ptr<SchnackLocalTtsState> state;
  {
    std::lock_guard<std::mutex> lock(g_local_tts_mutex);
    auto it = g_local_tts_instances.find(std::string(instanceId.UTF8String));
    if (it == g_local_tts_instances.end() || !it->second->tts.has_value()) {
      reject(@"local_tts_generate_error",
             @"The local TTS instance is not initialized.",
             nil);
      return;
    }
    state = it->second;
  }

  @try {
    auto audio = state->tts.value().Generate(std::string(text.UTF8String),
                                             static_cast<int32_t>(speakerId),
                                             static_cast<float>(speed));

    if (audio.samples.empty() || audio.sample_rate <= 0) {
      reject(@"local_tts_generate_error",
             @"The local TTS engine produced no audio.",
             nil);
      return;
    }

    NSString *targetPath = outputPath;
    if (targetPath.length == 0) {
      NSString *tmpName = [NSString stringWithFormat:@"local-tts-%@-%@.wav",
                                                     instanceId,
                                                     NSUUID.UUID.UUIDString];
      targetPath = [NSTemporaryDirectory() stringByAppendingPathComponent:tmpName];
    }

    BOOL saved = SaveWavFile(audio.samples,
                             audio.sample_rate,
                             std::string(targetPath.UTF8String));
    if (!saved) {
      reject(@"local_tts_generate_error",
             @"The generated local TTS audio could not be saved.",
             nil);
      return;
    }

    resolve(targetPath);
  } @catch (NSException *exception) {
    reject(@"local_tts_generate_error", exception.reason, nil);
  } catch (const std::exception &exception) {
    reject(@"local_tts_generate_error",
           [NSString stringWithUTF8String:exception.what()],
           nil);
  } catch (...) {
    reject(@"local_tts_generate_error",
           @"Unknown local TTS generation error.",
           nil);
  }
}

RCT_REMAP_METHOD(release,
                 releaseInstance:(NSString *)instanceId
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (instanceId.length == 0) {
    resolve(@NO);
    return;
  }

  @try {
    std::lock_guard<std::mutex> lock(g_local_tts_mutex);
    g_local_tts_instances.erase(std::string(instanceId.UTF8String));
    resolve(@YES);
  } @catch (NSException *exception) {
    reject(@"local_tts_release_error", exception.reason, nil);
  }
}

@end
