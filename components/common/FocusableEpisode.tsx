import type React from "react";
import { PropsWithChildren, useCallback, useState } from "react";
import { Platform, Pressable, TouchableOpacity } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface FocusableEpisodeProps extends PropsWithChildren {
  onPress?: () => void;
  onLongPress?: () => void;
  className?: string;
  style?: any;
  disabled?: boolean;
}

/**
 * TV-specific focusable component for episodes that uses background highlighting
 * instead of elevation to maintain text readability
 */
export const FocusableEpisode: React.FC<FocusableEpisodeProps> = ({
  onPress,
  onLongPress,
  className,
  style,
  disabled = false,
  children,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      backgroundColor: isFocused ? "rgba(255, 255, 255, 0.15)" : "transparent",
      borderRadius: 8,
      paddingHorizontal: isFocused ? 8 : 0,
      paddingVertical: isFocused ? 4 : 0,
    };
  });

  const handleFocus = useCallback(() => {
    if (Platform.isTV) {
      setIsFocused(true);
      scale.value = withSpring(1.02, {
        damping: 15,
        stiffness: 300,
      });
    }
  }, [scale]);

  const handleBlur = useCallback(() => {
    if (Platform.isTV) {
      setIsFocused(false);
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 300,
      });
    }
  }, [scale]);

  // TV Platform - use Pressable with subtle background highlighting
  if (Platform.isTV) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={className}
        style={style}
        disabled={disabled}
      >
        <Animated.View style={animatedStyle}>{children}</Animated.View>
      </Pressable>
    );
  }

  // Non-TV platforms - use regular TouchableOpacity
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      className={className}
      style={style}
      disabled={disabled}
    >
      {children}
    </TouchableOpacity>
  );
};
