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
  // When true, shows a border when the item is focused (TV only)
  borderOnFocus?: boolean;
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
  borderOnFocus = false,
  onFocus,
  onBlur,
  onKeyDown,
  children,
}) => {
  const { isFocused, animatedStyle, shadowStyle, handleFocus, handleBlur } =
    useFocusAnimation({ enableAnimation: !disableFocusAnimation });

  // TV Platform - use Pressable with elevation animation
  if (Platform.isTV) {
    // Border style applied only when focused and borderOnFocus is enabled
    // Kept separate from animation disable flag so users can show border without scale/elevation
    const focusBorderStyle =
      borderOnFocus && isFocused
        ? { borderWidth: 2, borderColor: "#FFFFFF", borderRadius: 4 }
        : undefined;

    return (
      <View style={{ overflow: "visible" }}>
        <Pressable
          onPress={onPress}
          onFocus={() => {
            handleFocus();
            try {
              onFocus?.();
            } catch {}
          }}
          onBlur={() => {
            handleBlur();
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
            style={[
              !disableFocusAnimation ? [animatedStyle, shadowStyle] : undefined,
              focusBorderStyle,
            ]}
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
