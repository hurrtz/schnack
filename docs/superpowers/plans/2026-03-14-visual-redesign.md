# Schnack Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a cohesive glow aesthetic across all UI components, with a ripple-ring center button as the hero element.

**Architecture:** Add new color tokens to the theme system, install `expo-linear-gradient`, then update each component bottom-up (theme → primitives → composites → screen). Each task is independent after Task 1 (color tokens) and Task 2 (dependency install).

**Tech Stack:** React Native 0.81, Expo SDK 54, react-native-reanimated 4.x, expo-linear-gradient ~14.0.2, @expo/vector-icons (Feather)

**Spec:** `docs/superpowers/specs/2026-03-14-visual-redesign-design.md`

---

## Chunk 1: Foundation + Core Components

### Task 1: Install dependency and update color tokens

**Files:**
- Modify: `src/theme/colors.ts:1-27`
- Modify: `package.json`

- [ ] **Step 1: Install expo-linear-gradient**

Run: `npx expo install expo-linear-gradient`

Expected: Package added to `package.json` with SDK 54 compatible version.

- [ ] **Step 2: Add new color tokens to dark theme**

In `src/theme/colors.ts`, add these properties to `darkColors` after `overlay`:

```ts
surfaceElevated: "#1E2A4A",
accentGradientStart: "#4A9EFF",
accentGradientEnd: "#2D6FBF",
glow: "rgba(74, 158, 255, 0.3)",
```

- [ ] **Step 3: Add new color tokens to light theme**

In `src/theme/colors.ts`, add these properties to `lightColors` after `overlay`:

```ts
surfaceElevated: "#F8F8FF",
accentGradientStart: "#4A9EFF",
accentGradientEnd: "#2D6FBF",
glow: "rgba(74, 158, 255, 0.2)",
```

- [ ] **Step 4: Verify TypeScript is happy**

Run: `npx tsc --noEmit`

Expected: No errors. The `Colors` type is derived via `typeof lightColors`, so the new tokens are automatically available on `colors.*` everywhere.

- [ ] **Step 5: Commit**

```bash
git add src/theme/colors.ts package.json package-lock.json
git commit -m "feat: add glow color tokens and expo-linear-gradient dependency"
```

---

### Task 2: WaveformCircle — Ripple Rings + Gradient Core

**Files:**
- Modify: `src/components/WaveformCircle.tsx:1-59`
- Reference: `src/components/Waveform.tsx` (existing pattern for Reanimated usage)

**Depends on:** Task 1

- [ ] **Step 1: Add imports**

Replace the imports in `WaveformCircle.tsx`:

```tsx
import React from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  GestureResponderEvent,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { Waveform } from "./Waveform";
import { InputMode } from "../types";
```

- [ ] **Step 2: Add WaveformCircleProps interface and RippleRing sub-component**

Add these above the `WaveformCircle` function:

```tsx
interface WaveformCircleProps {
  metering: number;
  isActive: boolean;
  inputMode: InputMode;
  onPressIn?: (e: GestureResponderEvent) => void;
  onPressOut?: (e: GestureResponderEvent) => void;
  onPress?: () => void;
}

function RippleRing({
  delay,
  color,
  isActive,
  intensity,
}: {
  delay: number;
  color: string;
  isActive: boolean;
  intensity: number; // 0-1, derived from metering
}) {
  // Scale ring animation speed with audio intensity:
  // louder audio = faster rings (1200ms at max, 2500ms at min)
  const duration = 2500 - intensity * 1300;
  // Scale peak opacity with intensity: louder = more visible rings
  const peakOpacity = 0.1 + intensity * 0.25;

  const animatedStyle = useAnimatedStyle(() => {
    if (!isActive) {
      return { opacity: 0, transform: [{ scale: 0.8 }] };
    }
    return {
      opacity: withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(peakOpacity, { duration: 0, easing: Easing.linear }),
            withTiming(0, { duration, easing: Easing.out(Easing.ease) })
          ),
          -1
        )
      ),
      transform: [
        {
          scale: withDelay(
            delay,
            withRepeat(
              withSequence(
                withTiming(0.7, { duration: 0, easing: Easing.linear }),
                withTiming(1.4, { duration, easing: Easing.out(Easing.ease) })
              ),
              -1
            )
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: 190,
          height: 190,
          borderRadius: 95,
          borderWidth: 1.5,
          borderColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}
```

- [ ] **Step 3: Rewrite WaveformCircle component**

Replace the existing `WaveformCircle` function and styles:

```tsx
export function WaveformCircle({
  metering,
  isActive,
  inputMode,
  onPressIn,
  onPressOut,
  onPress,
}: WaveformCircleProps) {
  const { colors } = useTheme();
  // Normalize metering from [-160, 0] to [0, 1] for ring intensity
  const intensity = Math.max(0, (metering + 160) / 160);

  return (
    <View style={styles.container}>
      {/* Ripple rings — only visible when active, intensity driven by metering */}
      <RippleRing delay={0} color={colors.accent} isActive={isActive} intensity={intensity} />
      <RippleRing delay={500} color={colors.accent} isActive={isActive} intensity={intensity} />
      <RippleRing delay={1000} color={colors.accent} isActive={isActive} intensity={intensity} />

      <TouchableOpacity
        activeOpacity={0.8}
        onPressIn={inputMode === "push-to-talk" ? onPressIn : undefined}
        onPressOut={inputMode === "push-to-talk" ? onPressOut : undefined}
        onPress={inputMode === "toggle-to-talk" ? onPress : undefined}
      >
        <LinearGradient
          colors={[colors.accentGradientStart, colors.accentGradientEnd]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[
            styles.circle,
            {
              shadowColor: colors.glow,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: isActive ? 1 : 0.5,
              shadowRadius: isActive ? 25 : 15,
              elevation: isActive ? 12 : 6,
            },
          ]}
        >
          <Waveform
            metering={metering}
            maxHeight={60}
            barCount={16}
            barColor="rgba(255, 255, 255, 0.9)"
            barColorInactive="rgba(255, 255, 255, 0.5)"
            isActive={isActive}
          />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    alignItems: "center",
    justifyContent: "center",
  },
});
```

- [ ] **Step 4: Update Waveform to accept custom bar colors**

In `src/components/Waveform.tsx`, add optional `barColor` and `barColorInactive` props to `WaveformProps`:

```ts
interface WaveformProps {
  metering: number;
  barCount?: number;
  barWidth?: number;
  barGap?: number;
  maxHeight: number;
  horizontal?: boolean;
  barColor?: string;       // NEW
  barColorInactive?: string; // NEW
  isActive?: boolean;       // NEW
}
```

In the `Waveform` function, destructure the new props with defaults:

```ts
barColor,
barColorInactive,
isActive = true,
```

Change the `color` passed to `AnimatedBar` from `colors.accent` to:

```ts
color={barColor ? (isActive ? barColor : (barColorInactive || barColor)) : colors.accent}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/WaveformCircle.tsx src/components/Waveform.tsx
git commit -m "feat: redesign WaveformCircle with ripple rings and gradient core"
```

---

### Task 3: ProviderToggle — Pill Toggle

**Files:**
- Modify: `src/components/ProviderToggle.tsx:1-63`

**Depends on:** Task 1

- [ ] **Step 1: Rewrite ProviderToggle**

Replace the entire file content:

```tsx
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { Provider } from "../types";

interface ProviderToggleProps {
  selected: Provider;
  onSelect: (provider: Provider) => void;
}

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

export function ProviderToggle({ selected, onSelect }: ProviderToggleProps) {
  const { colors } = useTheme();
  const isSecond = selected === "anthropic";
  const halfWidth = useSharedValue(0);

  const highlightStyle = useAnimatedStyle(() => ({
    width: halfWidth.value,
    transform: [
      {
        translateX: withTiming(isSecond ? halfWidth.value : 0, {
          duration: 250,
          easing: Easing.out(Easing.ease),
        }),
      },
    ],
  }));

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surface }]}
      onLayout={(e) => {
        halfWidth.value = (e.nativeEvent.layout.width - 8) / 2;
      }}
    >
      <Animated.View
        style={[
          styles.highlight,
          highlightStyle,
          {
            shadowColor: colors.glow,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 10,
            elevation: 8,
          },
        ]}
      >
        <LinearGradient
          colors={[colors.accentGradientStart, colors.accentGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.highlightGradient}
        />
      </Animated.View>

      {PROVIDERS.map((p) => (
        <Pressable
          key={p.value}
          style={styles.option}
          onPress={() => onSelect(p.value)}
        >
          <Text
            style={[
              styles.label,
              {
                color: selected === p.value ? "#FFFFFF" : colors.textSecondary,
                fontWeight: selected === p.value ? "600" : "500",
              },
            ]}
          >
            {p.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 25,
    padding: 4,
    position: "relative",
  },
  highlight: {
    position: "absolute",
    top: 4,
    left: 4,
    bottom: 4,
  },
  highlightGradient: {
    flex: 1,
    borderRadius: 21,
  },
  option: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    zIndex: 1,
  },
  label: {
    fontSize: 13,
  },
});
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProviderToggle.tsx
git commit -m "feat: redesign ProviderToggle as pill toggle with gradient highlight"
```

---

### Task 4: ChatBubble — Gradient + Shadow

**Files:**
- Modify: `src/components/ChatBubble.tsx:1-55`

**Depends on:** Task 1

- [ ] **Step 1: Update ChatBubble with gradient and shadows**

Replace the entire file:

```tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import { Message } from "../types";

interface ChatBubbleProps {
  message: Message;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === "user";

  const bubbleContent = (
    <>
      {!isUser && message.model && (
        <Text style={[styles.modelLabel, { color: colors.accent }]}>
          {message.model}
        </Text>
      )}
      <Text style={[styles.content, { color: colors.text }]}>
        {message.content}
      </Text>
    </>
  );

  return (
    <View
      style={[
        styles.wrapper,
        isUser ? styles.wrapperUser : styles.wrapperAssistant,
      ]}
    >
      {isUser ? (
        <LinearGradient
          colors={["rgba(74, 158, 255, 0.25)", "rgba(74, 158, 255, 0.12)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.bubble,
            styles.bubbleUser,
            {
              shadowColor: "rgba(74, 158, 255, 0.3)",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.4,
              shadowRadius: 6,
              elevation: 3,
            },
          ]}
        >
          {bubbleContent}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.bubble,
            styles.bubbleAssistant,
            {
              backgroundColor: colors.surfaceElevated,
              shadowColor: "rgba(0, 0, 0, 0.4)",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.5,
              shadowRadius: 4,
              elevation: 2,
            },
          ]}
        >
          {bubbleContent}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 3, paddingHorizontal: 16 },
  wrapperUser: { alignItems: "flex-end" },
  wrapperAssistant: { alignItems: "flex-start" },
  bubble: { maxWidth: "80%", padding: 12, borderRadius: 16 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAssistant: { borderBottomLeftRadius: 4 },
  modelLabel: { fontSize: 10, fontWeight: "500", letterSpacing: 0.5, marginBottom: 3 },
  content: { fontSize: 14, lineHeight: 20 },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatBubble.tsx
git commit -m "feat: redesign ChatBubble with gradient user bubbles and elevated assistant bubbles"
```

---

## Chunk 2: Screen-Level + Polish

### Task 5: MainScreen — Top Bar, Icons, Chat Preview

**Files:**
- Modify: `src/screens/MainScreen.tsx:1-368`

**Depends on:** Task 1

- [ ] **Step 1: Add Feather icon import**

Add at the top of `MainScreen.tsx`:

```ts
import { Feather } from "@expo/vector-icons";
```

- [ ] **Step 2: Update the title in both view modes**

Replace the title `<Text>` in the default view top bar (around line 235):

```tsx
<Text style={[styles.title, { color: colors.text }]}>
  VOX<Text style={{ color: colors.accent }}>AI</Text>
</Text>
```

- [ ] **Step 3: Replace emoji icons in default view**

Replace the hamburger button text (around line 233):

```tsx
<Feather name="menu" size={18} color={colors.textSecondary} />
```

Replace the settings button text (around line 240):

```tsx
<Feather name="settings" size={18} color={colors.textSecondary} />
```

- [ ] **Step 4: Replace emoji icons in expanded view**

Apply the same Feather icon replacements to the expanded view top bar (around lines 279-295):

Hamburger:
```tsx
<Feather name="menu" size={18} color={colors.textSecondary} />
```

Settings:
```tsx
<Feather name="settings" size={18} color={colors.textSecondary} />
```

- [ ] **Step 5: Update chat preview styling**

Update the `chatPreview` style and add a drag handle. Replace the chat preview `View` (around line 263-270):

```tsx
<View
  style={[styles.chatPreview, { backgroundColor: colors.surface }]}
>
  <View style={styles.dragHandle} />
  <ChatTranscript
    messages={messages}
    onTap={handleExpandChat}
  />
</View>
```

- [ ] **Step 6: Update styles**

Update the `styles` StyleSheet:

```ts
title: { fontSize: 18, fontWeight: "700", letterSpacing: 2 },
iconButton: {
  width: 36,
  height: 36,
  borderRadius: 10,
  alignItems: "center",
  justifyContent: "center",
},
chatPreview: {
  maxHeight: 160,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  shadowColor: "rgba(0, 0, 0, 0.4)",
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.5,
  shadowRadius: 10,
  elevation: 8,
},
```

Add the new `dragHandle` style:

```ts
dragHandle: {
  width: 36,
  height: 4,
  backgroundColor: "rgba(255, 255, 255, 0.15)",
  borderRadius: 2,
  alignSelf: "center",
  marginTop: 8,
  marginBottom: 4,
},
```

- [ ] **Step 7: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/screens/MainScreen.tsx
git commit -m "feat: update MainScreen with branded title, vector icons, and polished chat preview"
```

---

### Task 6: SettingsModal — Glow Active States + Entrance Animation

**Files:**
- Modify: `src/components/SettingsModal.tsx:1-210`

**Depends on:** Task 1

- [ ] **Step 1: Add Reanimated imports**

Add to the existing imports:

```ts
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  Easing,
} from "react-native-reanimated";
```

Also update the existing `import React from "react"` at the top of the file to:

```ts
import React, { useEffect } from "react";
```

- [ ] **Step 2: Update RadioGroup active state styling**

In the `RadioGroup` component, update the active button style (around line 46-50):

```tsx
style={[
  styles.radioButton,
  {
    borderColor: active ? colors.accent : colors.border,
    backgroundColor: active ? colors.accentSoft : colors.background,
    shadowColor: active ? colors.glow : "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: active ? 1 : 0,
    shadowRadius: active ? 6 : 0,
    elevation: active ? 4 : 0,
  },
]}
```

- [ ] **Step 3: Add entrance animation to SettingsModal**

Change `animationType` from `"fade"` to `"none"` on the `<Modal>`.

Inside `SettingsModal`, add scale animation:

```tsx
const scale = useSharedValue(0.95);
const opacity = useSharedValue(0);

useEffect(() => {
  if (visible) {
    scale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
    opacity.value = withTiming(1, { duration: 200 });
  } else {
    scale.value = 0.95;
    opacity.value = 0;
  }
}, [visible]);

const modalAnimStyle = useAnimatedStyle(() => ({
  transform: [{ scale: scale.value }],
  opacity: opacity.value,
}));
```

Wrap the modal content `View` in `Animated.View` with `modalAnimStyle`:

```tsx
<Animated.View
  style={[styles.modal, { backgroundColor: colors.surface }, modalAnimStyle]}
  onStartShouldSetResponder={() => true}
>
```

(Change the inner `View` to `Animated.View`.)

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "feat: add glow active states and entrance animation to SettingsModal"
```

---

### Task 7: ConversationDrawer — Glow Active States

**Files:**
- Modify: `src/components/ConversationDrawer.tsx:1-185`

**Depends on:** Task 1

- [ ] **Step 1: Add glow shadow to active conversation row**

Update the active conversation item style (around line 93-99). Add shadow properties:

```tsx
style={[
  styles.item,
  {
    borderLeftColor:
      item.id === activeId ? colors.accent : "transparent",
    backgroundColor:
      item.id === activeId ? colors.accentSoft : "transparent",
    shadowColor: item.id === activeId ? colors.glow : "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: item.id === activeId ? 1 : 0,
    shadowRadius: item.id === activeId ? 4 : 0,
    elevation: item.id === activeId ? 3 : 0,
  },
]}
```

- [ ] **Step 2: Update "New Session" button border**

In the `styles` StyleSheet (around line 157-163), remove `borderStyle: "dashed"` and change `borderWidth` to `1.5`:

```tsx
newSession: {
  margin: 12,
  marginHorizontal: 16,
  padding: 12,
  borderWidth: 1.5,
  borderRadius: 10,
  alignItems: "center",
},
```

The existing inline `{ borderColor: colors.accent }` on the `TouchableOpacity` already handles the color. Add glow shadow to the inline style:

```tsx
style={[
  styles.newSession,
  {
    borderColor: colors.accent,
    shadowColor: colors.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
]}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ConversationDrawer.tsx
git commit -m "feat: add glow active states to ConversationDrawer"
```

---

### Task 8: WaveformBar — Glow Active State

**Files:**
- Modify: `src/components/WaveformBar.tsx:1-62`

**Depends on:** Task 1

- [ ] **Step 1: Add gradient import and update active styling**

Add import:

```ts
import { LinearGradient } from "expo-linear-gradient";
```

Update the `WaveformBar` component. When active, use a `LinearGradient` as the bar background. When inactive, keep the current `View`:

```tsx
export function WaveformBar({
  metering,
  isActive,
  inputMode,
  onPressIn,
  onPressOut,
  onPress,
}: WaveformBarProps) {
  const { colors } = useTheme();

  const content = (
    <Waveform
      metering={metering}
      maxHeight={24}
      barCount={24}
      barWidth={2}
      barGap={1}
      barColor={isActive ? "rgba(255, 255, 255, 0.9)" : undefined}
      isActive={isActive}
    />
  );

  const glowShadow = {
    shadowColor: isActive ? colors.glow : "transparent",
    shadowOffset: { width: 0, height: 0 } as const,
    shadowOpacity: isActive ? 1 : 0,
    shadowRadius: isActive ? 8 : 0,
    elevation: isActive ? 4 : 0,
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPressIn={inputMode === "push-to-talk" ? onPressIn : undefined}
      onPressOut={inputMode === "push-to-talk" ? onPressOut : undefined}
      onPress={inputMode === "toggle-to-talk" ? onPress : undefined}
      style={{ flex: 1 }}
    >
      {isActive ? (
        <LinearGradient
          colors={[colors.accentGradientStart, colors.accentGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.bar, glowShadow]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.bar,
            glowShadow,
            {
              borderColor: colors.border,
              borderWidth: 2,
              backgroundColor: colors.surface,
            },
          ]}
        >
          {content}
        </View>
      )}
    </TouchableOpacity>
  );
}
```

Remove `borderColor`, `borderWidth`, and `backgroundColor` from the `bar` style since they're now applied conditionally. Keep `flex: 1` so the bar fills the available space in the expanded view top bar:

```ts
const styles = StyleSheet.create({
  bar: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/WaveformBar.tsx
git commit -m "feat: add gradient fill and glow to WaveformBar active state"
```

---

### Task 9: Final verification

**Depends on:** Tasks 1-8

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 2: Start the app and visually verify**

Run: `npx expo start`

Manually check:
- Center button shows gradient core at idle, ripple rings when recording/playing
- Provider toggle slides smoothly between options with gradient highlight
- Chat bubbles have gradient (user) and elevated (assistant) styling
- Top bar shows "VOX**AI**" with Feather icons
- Chat preview has rounded corners and drag handle
- Settings modal scales in, radio buttons glow when active
- Conversation drawer active row glows
- WaveformBar in expanded view uses gradient when active

- [ ] **Step 3: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "fix: visual polish adjustments after manual review"
```
