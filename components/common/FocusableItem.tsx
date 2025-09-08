import type React from "react";
import { PropsWithChildren } from "react";
import { Platform, Pressable, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import { useFocusAnimation } from "@/hooks/useFocusAnimation";

interface FocusableItemProps extends PropsWithChildren {
  onPress?: () => void;
  className?: string;
  style?: any;
  disabled?: boolean;
  hasTVPreferredFocus?: boolean;
  // When true, disables the default elevation/scale focus animation on TV
  disableFocusAnimation?: boolean;
  // Optional TV focus/keyboard handlers (forwarded to underlying Pressable on TV)
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: any) => void;
}

/**
 * Reusable component for focusable items with elevation effects
 * Automatically handles platform detection and provides consistent animations
 */
export const FocusableItem: React.FC<FocusableItemProps> = ({
  onPress,
  className,
  style,
  disabled = false,
  hasTVPreferredFocus = false,
  disableFocusAnimation = false,
  onFocus,
  onBlur,
  onKeyDown,
  children,
}) => {
  const { animatedStyle, shadowStyle, handleFocus, handleBlur } =
    useFocusAnimation();

  // TV Platform - use Pressable with elevation animation
  if (Platform.isTV) {
    return (
      <View style={{ overflow: "visible" }}>
        <Pressable
          onPress={onPress}
          onFocus={() => {
            if (!disableFocusAnimation) handleFocus();
            try {
              onFocus?.();
            } catch {}
          }}
          onBlur={() => {
            if (!disableFocusAnimation) handleBlur();
            try {
              onBlur?.();
            } catch {}
          }}
          className={className}
          style={[style, { overflow: "visible" }]}
          disabled={disabled}
          hasTVPreferredFocus={hasTVPreferredFocus}
          // @ts-expect-error onKeyDown exists on TV targets
          onKeyDown={onKeyDown}
        >
          <Animated.View
            style={
              disableFocusAnimation ? undefined : [animatedStyle, shadowStyle]
            }
          >
            {children}
          </Animated.View>
        </Pressable>
      </View>
    );
  }

  // Non-TV platforms - use regular TouchableOpacity
  return (
    <TouchableOpacity
      onPress={onPress}
      className={className}
      style={style}
      disabled={disabled}
    >
      {children}
    </TouchableOpacity>
  );
};
