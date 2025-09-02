import { useCallback, useState } from "react";
import { Platform } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

export interface FocusAnimationProps {
  isFocused: boolean;
  animatedStyle: any;
  shadowStyle: {
    shadowOffset: {
      width: number;
      height: number;
    };
  };
  handleFocus: () => void;
  handleBlur: () => void;
}

/**
 * Custom hook for focus animations with elevation effects
 * Provides consistent scale, shadow, and elevation animations across components
 * current implementation provides only focus and blur handlers for tv platform
 */
export const useFocusAnimation = (): FocusAnimationProps => {
  const [isFocused, setIsFocused] = useState(false);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      shadowColor: "#000",
      shadowOpacity: isFocused ? 0.4 : 0,
      shadowRadius: isFocused ? 15 : 0,
      elevation: isFocused ? 12 : 0,
      zIndex: isFocused ? 999 : 1,
    };
  });

  const shadowStyle = {
    shadowOffset: {
      width: 0,
      height: 8,
    },
  };

  const handleFocus = useCallback(() => {
    if (Platform.isTV) {
      setIsFocused(true);
      scale.value = withSpring(1.16, {
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

  return {
    isFocused,
    animatedStyle,
    shadowStyle,
    handleFocus,
    handleBlur,
  };
};
