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
