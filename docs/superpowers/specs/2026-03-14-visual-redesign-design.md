# Schnack Visual Redesign — Cohesive Glow Aesthetic

## Overview

Visual polish pass across all UI components. The app currently reads as a functional prototype — this redesign adds depth, glow effects, better typography, and refined micro-interactions to make it feel premium. The center button (ripple rings + solid gradient core) is the hero; the rest of the UI shares the "light in the dark" glow language.

## Design Decisions

- **Direction chosen:** Cohesive Glow — accent glow/gradient language extends from center button throughout all components
- **Center button:** Ripple Rings + Solid Core (option B) — solid blue gradient core with white waveform bars, concentric rings ripple outward driven by audio metering
- **Provider toggle:** Pill-shaped with sliding gradient highlight (replaces two separate bordered rectangles)
- **Icons:** Replace emoji (☰ ⚙) with `@expo/vector-icons` Feather set

## New Dependency

- `expo-linear-gradient: "~14.0.2"` — for center button gradient fill and user bubble gradients (pinned to Expo SDK 54)

## Color Palette Changes

Add to both light and dark themes in `colors.ts`:

```ts
// Dark theme additions
surfaceElevated: "#1E2A4A",     // third-level surface for bubbles/cards (background → surface → surfaceElevated)
accentGradientStart: "#4A9EFF", // gradient start for buttons/highlights
accentGradientEnd: "#2D6FBF",   // gradient end
glow: "rgba(74,158,255,0.3)",   // exclusively for shadowColor / elevation glow effects

// Light theme additions
surfaceElevated: "#F8F8FF",     // slightly tinted white, distinct from background (#FFFFFF)
accentGradientStart: "#4A9EFF",
accentGradientEnd: "#2D6FBF",
glow: "rgba(74,158,255,0.2)",
```

**Surface elevation hierarchy:** `background` → `surface` → `surfaceElevated` (each progressively lighter in dark mode, darker in light mode).

**Token distinction:** `accentSoft` (existing) is for translucent background fills on active states. `glow` (new) is exclusively for `shadowColor` properties — never for backgrounds.

## Component Changes

### 1. WaveformCircle — Ripple Rings + Gradient Core

**Idle state:**
- Solid gradient core (linear-gradient 160deg, `accentGradientStart` → `accentGradientEnd`)
- Subtle box shadow glow: `0 0 30px glow` at reduced opacity
- Waveform bars: white at 50% opacity, small/muted heights
- No ripple rings

**Active state (recording/playing):**
- Core gradient brightens, shadow glow intensifies to `0 0 50px glow`
- 3 concentric ring `Animated.View`s with staggered scale+opacity animations
- Rings expand from ~0.7x to ~1.4x scale while fading from 25% to 0% opacity
- Ring animation speed/intensity scaled to metering value
- Waveform bars: white at 90% opacity, full metering-driven animation

**Implementation:** Use `expo-linear-gradient` for core fill. 3 Reanimated `Animated.View` rings (from `react-native-reanimated`, consistent with the existing `Waveform.tsx` pattern) with `useAnimatedStyle` driven by a shared `ringProgress` value. Ring stagger via offsets (0, 0.5s, 1s).

### 2. ProviderToggle — Pill Toggle

Replace two separate `TouchableOpacity` buttons with a single pill container:

- Outer container: `surface` background, full border-radius (capsule shape), 4px padding
- Sliding highlight: absolute-positioned `Animated.View` with gradient fill + glow shadow, width = 50% of container
- Animate `translateX` between 0 and container-half-width on provider change
- Active text: white, fontWeight 600
- Inactive text: `textSecondary`, fontWeight 500

### 3. ChatBubble — Gradient + Shadow

**User bubbles:**
- Background: `LinearGradient` from `rgba(74,158,255,0.25)` to `rgba(74,158,255,0.12)` at 135deg (derived from `accentGradientStart`)
- Shadow: `0 2px 12px rgba(74,158,255,0.1)`
- Border radius: 16px with 4px bottom-right

**Assistant bubbles:**
- Background: `surfaceElevated` (solid, no gradient)
- Shadow: `0 2px 8px rgba(0,0,0,0.2)`
- Border radius: 16px with 4px bottom-left
- Model label: accent color instead of `textSecondary`, fontWeight 500, letterSpacing 0.5

### 4. MainScreen — Top Bar

**Title:** "VOX" in `text` color + "AI" in `accent` color. letterSpacing: 2.

**Icon buttons:**
- Replace `<Text>☰</Text>` with `<Feather name="menu" size={18} />`
- Replace `<Text>⚙</Text>` with `<Feather name="settings" size={18} />`
- Button size: 36x36, borderRadius 10
- Icon color: `textSecondary`
- These changes apply to icon buttons in **both** `viewMode === "default"` and `viewMode === "expanded"`

**Chat preview area:**
- Border radius: 20px (top corners)
- Add drag handle: 36x4px bar, `rgba(255,255,255,0.15)`, centered, borderRadius 2
- Add upward shadow: `0 -4px 20px rgba(0,0,0,0.2)`

### 5. SettingsModal — Glow Active States

- Active radio button: gradient border effect (use accent background with glow shadow instead of flat border)
- Active radio background: `accentSoft` with shadow `0 0 12px glow`
- Modal entrance: change `animationType` from `"fade"` to `"none"` on the `<Modal>`, add scale animation (0.95 → 1.0) via Reanimated on the inner view to avoid conflicting animation systems

### 6. ConversationDrawer — Glow Active States

- Active conversation: keep left border accent + `accentSoft` background, add shadow `0 0 8px glow`
- "New Session" button: solid accent border (replace dashed), subtle glow on press

### 7. WaveformBar (Expanded View)

- Match the glow language: active state gets glow shadow
- Bar background when active: gradient fill matching the pill toggle style
- Keep compact sizing

## Files to Modify

1. `src/theme/colors.ts` — add `surfaceElevated`, `accentGradientStart`, `accentGradientEnd`, `glow`
2. `src/components/WaveformCircle.tsx` — ripple rings + gradient core rewrite
3. `src/components/ProviderToggle.tsx` — pill toggle rewrite
4. `src/components/ChatBubble.tsx` — gradient user bubbles, elevated assistant bubbles
5. `src/screens/MainScreen.tsx` — top bar branding/icons, chat preview styling
6. `src/components/SettingsModal.tsx` — glow active states, entrance animation
7. `src/components/ConversationDrawer.tsx` — glow active states
8. `src/components/WaveformBar.tsx` — glow active state

## Out of Scope

- Font family changes (system font is fine)
- Dark/light theme rework (just adding tokens to both)
- Layout or interaction model changes
- New screens or navigation changes
