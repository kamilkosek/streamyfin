import type React from "react";
import { PropsWithChildren } from "react";
import { Platform, Pressable, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import { useTVFocusAnimation } from "@/hooks/useTVFocusAnimation";

interface TVFocusableItemProps extends PropsWithChildren {
  onPress?: () => void;
  className?: string;
  style?: any;
  disabled?: boolean;
}

/**
 * Reusable component for TV-focusable items with elevation effects
 * Automatically handles platform detection and provides consistent animations
 */
export const TVFocusableItem: React.FC<TVFocusableItemProps> = ({
  onPress,
  className,
  style,
  disabled = false,
  children,
}) => {
  const { animatedStyle, shadowStyle, handleFocus, handleBlur } =
    useTVFocusAnimation();

  // TV Platform - use Pressable with elevation animation
  if (Platform.isTV) {
    return (
      <View style={{ overflow: "visible" }}>
        <Pressable
          onPress={onPress}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={className}
          style={[style, { overflow: "visible" }]}
          disabled={disabled}
        >
          <Animated.View style={[animatedStyle, shadowStyle]}>
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
