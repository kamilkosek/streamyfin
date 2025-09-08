import React, { memo, useMemo, useState } from "react";
import { Platform, useTVEventHandler, View } from "react-native";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { FocusableItem } from "@/components/common/FocusableItem";
import { Colors } from "@/constants/Colors";

/**
 * TVSlider - a TV-first, focusable progress slider for media playback.
 *
 * Goals:
 * - Keyboard/remote focus semantics (no gesture handler dependency)
 * - Visual progress, cache/buffer, and optional segment highlights
 * - Trickplay bubble anchor via renderBubble
 * - API intentionally similar to react-native-awesome-slider
 */

export interface Segment {
  start: number; // absolute value within [min,max]
  end: number; // absolute value within [min,max]
  color?: string; // custom color; defaults to semi-transparent white
}

export interface TVSliderProps {
  progress: SharedValue<number>;
  minimumValue: SharedValue<number>;
  maximumValue: SharedValue<number>;
  cache?: SharedValue<number>; // buffered value within [min,max]
  onSlidingStart?: () => void;
  onSlidingComplete?: (value: number) => void;
  onValueChange?: (value: number) => void;
  sliderHeight?: number;
  trackRadius?: number;
  theme?: {
    backgroundTrackTintColor?: string;
    minimumTrackTintColor?: string; // played
    cacheTrackTintColor?: string; // buffered
    focusRingColor?: string;
  };
  // Renders a bubble above the current progress when focused/scrubbing
  renderBubble?: () => React.ReactNode;
  // Render a custom thumb. TV uses focus highlight and optional dot.
  renderThumb?: () => React.ReactNode;
  // Segments for chapter/commercial/intro highlighting
  segments?: Segment[];
  // When true, show a small circle over progress to indicate focus
  showFocusDot?: boolean;
  // Optional key handler for extra keys (ArrowUp/Down etc.)
  onKeyDown?: (e: any) => void;
}

// Avoid helper functions in UI worklets; use inline Math.min/Math.max where needed.

export const TVSlider = memo(function TVSlider({
  progress,
  minimumValue,
  maximumValue,
  cache,
  onSlidingStart,
  onSlidingComplete,
  onValueChange,
  sliderHeight = 8,
  trackRadius = 100,
  theme,
  renderBubble,
  renderThumb,
  segments = [],
  showFocusDot = true,
  onKeyDown,
}: TVSliderProps) {
  const min = minimumValue;
  const max = maximumValue;

  const width = useSharedValue(0);
  const isFocused = useSharedValue(false);
  const localValue = useSharedValue<number | null>(null);
  const [focused, setFocused] = useState(false);

  const handleJump = (direction: -1 | 1) => {
    const range = max.value - min.value;
    if (range <= 0) return;
    const step = range * 0.1; // 10% jump
    const base = localValue.value ?? progress.value;
    const v = Math.min(max.value, Math.max(min.value, base + direction * step));
    if (localValue.value == null) onSlidingStart?.();
    localValue.value = v;
    onValueChange?.(v);
  };

  // Global TV event fallback when slider is focused
  useTVEventHandler((evt) => {
    if (!Platform.isTV || !focused || !evt) return;
    const t = evt.eventType;
    if (t === "left") handleLeft();
    if (t === "right") handleRight();
    if (t === "select") handleSelect();
    // Long-press or dedicated keys typically map to rewind/fastForward on TVs
    if (t === "rewind" || t === "longLeft") handleJump(-1);
    if (t === "fastForward" || t === "longRight") handleJump(1);
  });

  const colors = {
    back: theme?.backgroundTrackTintColor ?? "rgba(255,255,255,0.2)",
    min: theme?.minimumTrackTintColor ?? Colors.primary,
    cache: theme?.cacheTrackTintColor ?? "rgba(255,255,255,0.3)",
    ring: theme?.focusRingColor ?? "rgba(255,255,255,0.6)",
  } as const;

  // Effective value while scrubbing
  const eff = useDerivedValue(() => localValue.value ?? progress.value);

  const pct = useDerivedValue(() => {
    const range = max.value - min.value;
    if (range <= 0) return 0;
    const raw = (eff.value - min.value) / range;
    return Math.min(1, Math.max(0, raw));
  });

  const cachePct = useDerivedValue(() => {
    if (!cache) return 0;
    const range = max.value - min.value;
    if (range <= 0) return 0;
    const raw = (cache.value - min.value) / range;
    return Math.min(1, Math.max(0, raw));
  });

  // Focus/blur are handled via FocusableItem props; update isFocused there

  const handleLeft = () => {
    // Step by 1 second worth of unit. Decision left to parent; for now use 1/100 of width range
    const range = max.value - min.value;
    const step = range / 100;
    const base = localValue.value ?? progress.value;
    const v = Math.min(max.value, Math.max(min.value, base - step));
    if (localValue.value == null) onSlidingStart?.();
    localValue.value = v;
    onValueChange?.(v);
  };

  const handleRight = () => {
    const range = max.value - min.value;
    const step = range / 100;
    const base = localValue.value ?? progress.value;
    const v = Math.min(max.value, Math.max(min.value, base + step));
    if (localValue.value == null) onSlidingStart?.();
    localValue.value = v;
    onValueChange?.(v);
  };

  const handleSelect = () => {
    if (localValue.value != null) {
      const v = Math.min(max.value, Math.max(min.value, localValue.value));
      onSlidingComplete?.(v);
      progress.value = v; // commit
      localValue.value = null;
    }
  };

  const containerStyle = useMemo(
    () => ({
      width: "100%" as const,
      height: sliderHeight,
      borderRadius: trackRadius,
      overflow: "hidden" as const,
      backgroundColor: colors.back,
    }),
    [sliderHeight, trackRadius, colors.back],
  );

  const minStyle = useAnimatedStyle(() => ({
    width: width.value * pct.value,
    height: "100%",
    backgroundColor: colors.min,
  }));

  const cacheStyle = useAnimatedStyle(() => ({
    width: width.value * cachePct.value,
    height: "100%",
    backgroundColor: colors.cache,
    position: "absolute",
    top: 0,
    left: 0,
  }));

  const focusRing = useAnimatedStyle(() => ({
    opacity: withTiming(isFocused.value ? 1 : 0, { duration: 120 }),
    borderColor: colors.ring,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    left: width.value * pct.value,
    transform: [{ translateX: -6 }],
  }));

  const dotOpacityStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isFocused.value ? 1 : 0, { duration: 120 }),
  }));

  return (
    <FocusableItem
      className={"w-full"}
      disableFocusAnimation
      onPress={handleSelect}
      onKeyDown={(e: any) => {
        if (!Platform.isTV) return;
        if (__DEV__) console.log("TVSlider keyDown", e?.eventKeyAction, e?.key);
        const key = e?.key || e?.nativeEvent?.key;
        const code = e?.nativeEvent?.keyCode;
        const isLeft =
          key === "ArrowLeft" ||
          key === "Left" ||
          key === "left" ||
          code === 21;
        const isRight =
          key === "ArrowRight" ||
          key === "Right" ||
          key === "right" ||
          code === 22;
        const isSelect =
          key === "Enter" ||
          key === "Select" ||
          key === "select" ||
          code === 23 ||
          code === 66;

        if (isLeft) {
          e.preventDefault?.();
          e.stopPropagation?.();
          handleLeft();
          return;
        }
        if (isRight) {
          e.preventDefault?.();
          e.stopPropagation?.();
          handleRight();
          return;
        }
        if (isSelect) {
          e.preventDefault?.();
          e.stopPropagation?.();
          handleSelect();
          return;
        }
        // bubble others to parent (e.g., ArrowDown to open episode list)
        try {
          onKeyDown?.(e);
        } catch {}
      }}
      onFocus={() => {
        if (__DEV__) console.log("TVSlider focus");
        isFocused.value = true;
        setFocused(true);
      }}
      onBlur={() => {
        if (__DEV__) console.log("TVSlider blur");
        isFocused.value = false;
        setFocused(false);
        if (localValue.value != null) {
          const v = Math.min(max.value, Math.max(min.value, localValue.value));
          onSlidingComplete?.(v);
          progress.value = v; // sync
          localValue.value = null;
        }
      }}
      // Focus/blur handled via internal Pressable of FocusableItem
      style={{ paddingVertical: 8, width: "100%" }}
    >
      {/* Global TV events handled via useTVEventHandler above */}
      <View
        onLayout={(e) => {
          width.value = e.nativeEvent.layout.width;
        }}
        style={containerStyle}
      >
        {/* cache layer */}
        <Animated.View style={cacheStyle} />
        {/* played layer */}
        <Animated.View style={minStyle} />
        {/* segments overlay */}
        {segments.map((s, idx) => {
          const range = max.value - min.value;
          if (range <= 0) return null;
          const startNorm = (s.start - min.value) / range;
          const endNorm = (s.end - min.value) / range;
          const startPct = Math.min(1, Math.max(0, startNorm)) * 100;
          const endPct = Math.min(1, Math.max(0, endNorm)) * 100;
          const w = Math.max(0, endPct - startPct);
          if (!Number.isFinite(w) || w <= 0) return null;
          return (
            <View
              key={`${idx}-${s.start}-${s.end}`}
              style={{
                position: "absolute",
                left: `${startPct}%`,
                width: `${w}%`,
                top: 0,
                bottom: 0,
                backgroundColor: s.color ?? "rgba(255,255,255,0.15)",
              }}
              pointerEvents='none'
            />
          );
        })}
      </View>

      {/* focus ring */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            borderWidth: 2,
            borderRadius: trackRadius,
          },
          focusRing,
        ]}
        pointerEvents='none'
      />

      {/* progress focus dot and bubble */}
      {showFocusDot && (
        <Animated.View
          style={[
            {
              position: "absolute",
              height: sliderHeight + 8,
              width: 12,
              top: -4,
            },
            dotStyle,
          ]}
          pointerEvents='none'
        >
          <Animated.View
            style={[
              {
                height: 12,
                width: 12,
                borderRadius: 6,
                backgroundColor: Colors.primary,
                borderWidth: 2,
                borderColor: "#fff",
              },
              dotOpacityStyle,
            ]}
          />
          {/* bubble anchor - only show while focused */}
          {renderBubble && focused && (
            <View style={{ position: "absolute", bottom: sliderHeight + 6 }}>
              {renderBubble()}
            </View>
          )}
        </Animated.View>
      )}

      {/* custom thumb as overlay, if provided */}
      {renderThumb && (
        <Animated.View
          style={[{ position: "absolute", top: -8 }, dotStyle]}
          pointerEvents='none'
        >
          {renderThumb()}
        </Animated.View>
      )}
    </FocusableItem>
  );
});

export default TVSlider;
