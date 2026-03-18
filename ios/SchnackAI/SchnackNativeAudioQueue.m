#import <AVFoundation/AVFoundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTLog.h>

static NSString *const SchnackNativeAudioQueueEventName = @"SchnackNativeAudioQueueEvent";

@interface SchnackNativeAudioQueue : RCTEventEmitter <RCTBridgeModule>
@end

@implementation SchnackNativeAudioQueue {
  AVQueuePlayer *_player;
  NSMutableDictionary<NSString *, NSDictionary *> *_contextsByItemKey;
  NSMutableSet<NSString *> *_startedItemKeys;
  NSString *_currentItemKey;
  BOOL _hasListeners;
  BOOL _observingPlayer;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (instancetype)init
{
  if ((self = [super init])) {
    _contextsByItemKey = [NSMutableDictionary new];
    _startedItemKeys = [NSMutableSet new];
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ SchnackNativeAudioQueueEventName ];
}

- (void)startObserving
{
  _hasListeners = YES;
  [self ensurePlayer];
}

- (void)stopObserving
{
  _hasListeners = NO;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (void)ensurePlayer
{
  if (_player != nil) {
    return;
  }

  _player = [AVQueuePlayer queuePlayerWithItems:@[]];
  _player.actionAtItemEnd = AVPlayerActionAtItemEndAdvance;
  if ([_player respondsToSelector:@selector(setAutomaticallyWaitsToMinimizeStalling:)]) {
    _player.automaticallyWaitsToMinimizeStalling = NO;
  }

  [self attachPlayerObserversIfNeeded];
}

- (void)attachPlayerObserversIfNeeded
{
  if (_observingPlayer || _player == nil) {
    return;
  }

  [_player addObserver:self
            forKeyPath:@"currentItem"
               options:NSKeyValueObservingOptionInitial | NSKeyValueObservingOptionNew
               context:nil];
  [_player addObserver:self
            forKeyPath:@"timeControlStatus"
               options:NSKeyValueObservingOptionInitial | NSKeyValueObservingOptionNew
               context:nil];
  _observingPlayer = YES;
}

- (void)detachPlayerObserversIfNeeded
{
  if (!_observingPlayer || _player == nil) {
    return;
  }

  @try {
    [_player removeObserver:self forKeyPath:@"currentItem"];
    [_player removeObserver:self forKeyPath:@"timeControlStatus"];
  } @catch (__unused NSException *exception) {
  }

  _observingPlayer = NO;
}

- (NSString *)itemKey:(AVPlayerItem *)item
{
  return [NSString stringWithFormat:@"%p", item];
}

- (void)emitEvent:(NSDictionary *)payload
{
  if (!_hasListeners) {
    return;
  }

  [self sendEventWithName:SchnackNativeAudioQueueEventName body:payload];
}

- (void)emitStartedForCurrentItemIfNeeded
{
  AVPlayerItem *item = _player.currentItem;
  if (item == nil || _player.timeControlStatus != AVPlayerTimeControlStatusPlaying) {
    return;
  }

  NSString *itemKey = [self itemKey:item];
  NSDictionary *context = _contextsByItemKey[itemKey];

  if (context == nil || [_startedItemKeys containsObject:itemKey]) {
    return;
  }

  [_startedItemKeys addObject:itemKey];
  _currentItemKey = itemKey;

  [self emitEvent:@{
    @"type": @"started",
    @"itemId": context[@"itemId"] ?: @"",
    @"uri": context[@"uri"] ?: @"",
    @"requestId": context[@"requestId"] ?: [NSNull null],
    @"source": context[@"source"] ?: [NSNull null],
  }];
}

- (void)emitDrainedIfNeeded
{
  if (_player == nil) {
    return;
  }

  if (_player.currentItem != nil || _player.items.count > 0) {
    return;
  }

  _currentItemKey = nil;
  [_startedItemKeys removeAllObjects];
  [self emitEvent:@{ @"type": @"drained" }];
}

- (void)removeObserversForItem:(AVPlayerItem *)item
{
  [[NSNotificationCenter defaultCenter] removeObserver:self
                                                  name:AVPlayerItemDidPlayToEndTimeNotification
                                                object:item];
  [[NSNotificationCenter defaultCenter] removeObserver:self
                                                  name:AVPlayerItemFailedToPlayToEndTimeNotification
                                                object:item];
}

- (void)cleanupItem:(AVPlayerItem *)item
{
  NSString *itemKey = [self itemKey:item];
  [self removeObserversForItem:item];
  [_contextsByItemKey removeObjectForKey:itemKey];
  [_startedItemKeys removeObject:itemKey];
  if ([_currentItemKey isEqualToString:itemKey]) {
    _currentItemKey = nil;
  }
}

- (NSURL *)resolvedURLForUri:(NSString *)uri
{
  NSURL *url = [NSURL URLWithString:uri];
  if (url != nil && url.scheme.length > 0) {
    return url;
  }

  return [NSURL fileURLWithPath:uri];
}

RCT_REMAP_METHOD(prepare,
                 prepareWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    [self ensurePlayer];

    AVAudioSession *session = [AVAudioSession sharedInstance];
    NSError *categoryError = nil;
    NSError *activeError = nil;

    [session setCategory:AVAudioSessionCategoryPlayback
             withOptions:0
                   error:&categoryError];
    if (categoryError != nil) {
      reject(@"audio_session_category_error",
             categoryError.localizedDescription,
             categoryError);
      return;
    }

    [session setActive:YES error:&activeError];
    if (activeError != nil) {
      reject(@"audio_session_active_error",
             activeError.localizedDescription,
             activeError);
      return;
    }

    resolve(@YES);
  } @catch (NSException *exception) {
    reject(@"audio_queue_prepare_error", exception.reason, nil);
  }
}

RCT_REMAP_METHOD(enqueue,
                 enqueueUri:(NSString *)uri
                 itemId:(NSString *)itemId
                 requestId:(NSString *)requestId
                 source:(NSString *)source
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (uri.length == 0 || itemId.length == 0) {
    reject(@"audio_queue_enqueue_error", @"Audio URI and itemId are required.", nil);
    return;
  }

  @try {
    [self ensurePlayer];

    NSURL *url = [self resolvedURLForUri:uri];
    AVPlayerItem *item = [AVPlayerItem playerItemWithURL:url];
    NSString *itemKey = [self itemKey:item];

    _contextsByItemKey[itemKey] = @{
      @"itemId": itemId,
      @"uri": uri,
      @"requestId": requestId ?: [NSNull null],
      @"source": source ?: [NSNull null],
    };

    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleItemDidPlayToEnd:)
                                                 name:AVPlayerItemDidPlayToEndTimeNotification
                                               object:item];
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleItemFailedToPlayToEnd:)
                                                 name:AVPlayerItemFailedToPlayToEndTimeNotification
                                               object:item];

    [_player insertItem:item afterItem:nil];
    resolve(@YES);
  } @catch (NSException *exception) {
    reject(@"audio_queue_enqueue_error", exception.reason, nil);
  }
}

RCT_REMAP_METHOD(start,
                 startWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    [self ensurePlayer];
    if (_player.currentItem == nil && _player.items.count == 0) {
      resolve(@NO);
      return;
    }

    [_player play];
    [self emitStartedForCurrentItemIfNeeded];
    resolve(@YES);
  } @catch (NSException *exception) {
    reject(@"audio_queue_start_error", exception.reason, nil);
  }
}

RCT_REMAP_METHOD(stop,
                 stopWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    if (_player != nil) {
      [_player pause];
      [_player removeAllItems];
    }

    NSArray<NSString *> *itemKeys = _contextsByItemKey.allKeys.copy;
    for (NSString *itemKey in itemKeys) {
      NSDictionary *context = _contextsByItemKey[itemKey];
      [self emitEvent:@{
        @"type": @"stopped",
        @"itemId": context[@"itemId"] ?: @"",
        @"uri": context[@"uri"] ?: @"",
        @"requestId": context[@"requestId"] ?: [NSNull null],
        @"source": context[@"source"] ?: [NSNull null],
      }];
    }

    [_contextsByItemKey removeAllObjects];
    [_startedItemKeys removeAllObjects];
    _currentItemKey = nil;
    [self emitDrainedIfNeeded];
    resolve(@YES);
  } @catch (NSException *exception) {
    reject(@"audio_queue_stop_error", exception.reason, nil);
  }
}

- (void)handleItemDidPlayToEnd:(NSNotification *)notification
{
  AVPlayerItem *item = notification.object;
  if (item == nil) {
    return;
  }

  NSString *itemKey = [self itemKey:item];
  NSDictionary *context = _contextsByItemKey[itemKey];
  if (context != nil) {
    [self emitEvent:@{
      @"type": @"finished",
      @"itemId": context[@"itemId"] ?: @"",
      @"uri": context[@"uri"] ?: @"",
      @"requestId": context[@"requestId"] ?: [NSNull null],
      @"source": context[@"source"] ?: [NSNull null],
    }];
  }

  [self cleanupItem:item];

  dispatch_async(dispatch_get_main_queue(), ^{
    [self emitStartedForCurrentItemIfNeeded];
    [self emitDrainedIfNeeded];
  });
}

- (void)handleItemFailedToPlayToEnd:(NSNotification *)notification
{
  AVPlayerItem *item = notification.object;
  if (item == nil) {
    return;
  }

  NSString *itemKey = [self itemKey:item];
  NSDictionary *context = _contextsByItemKey[itemKey];
  NSError *error = notification.userInfo[AVPlayerItemFailedToPlayToEndTimeErrorKey];

  if (context != nil) {
    [self emitEvent:@{
      @"type": @"failed",
      @"itemId": context[@"itemId"] ?: @"",
      @"uri": context[@"uri"] ?: @"",
      @"requestId": context[@"requestId"] ?: [NSNull null],
      @"source": context[@"source"] ?: [NSNull null],
      @"message": error.localizedDescription ?: @"Audio playback failed.",
    }];
  }

  [self cleanupItem:item];

  dispatch_async(dispatch_get_main_queue(), ^{
    [self emitStartedForCurrentItemIfNeeded];
    [self emitDrainedIfNeeded];
  });
}

- (void)observeValueForKeyPath:(NSString *)keyPath
                      ofObject:(id)object
                        change:(NSDictionary<NSKeyValueChangeKey, id> *)change
                       context:(void *)context
{
  if (object != _player) {
    [super observeValueForKeyPath:keyPath ofObject:object change:change context:context];
    return;
  }

  if ([keyPath isEqualToString:@"currentItem"] || [keyPath isEqualToString:@"timeControlStatus"]) {
    [self emitStartedForCurrentItemIfNeeded];
    return;
  }

  [super observeValueForKeyPath:keyPath ofObject:object change:change context:context];
}

- (void)invalidate
{
  [super invalidate];
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  [self detachPlayerObserversIfNeeded];
  [_player pause];
  [_player removeAllItems];
  _player = nil;
  [_contextsByItemKey removeAllObjects];
  [_startedItemKeys removeAllObjects];
  _currentItemKey = nil;
}

@end
