import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  type TextStyle,
  TVEventControl,
  useTVEventHandler,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export interface ActionSheetOption {
  title: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface ActionSheetProps {
  title?: string;
  message?: string;
  options: ActionSheetOption[];
  cancelButtonTitle?: string;
  containerStyle?: ViewStyle;
  titleStyle?: TextStyle;
  messageStyle?: TextStyle;
  optionStyle?: ViewStyle;
  optionTextStyle?: TextStyle;
  destructiveTextStyle?: TextStyle;
  cancelButtonStyle?: ViewStyle;
  cancelButtonTextStyle?: TextStyle;
  backdropOpacity?: number;
  animationDuration?: number;
  onCancel?: () => void;
  onDismiss?: () => void; // Called when modal is fully dismissed
  visible?: boolean;
}

export interface ActionSheetRef {
  show: () => void;
  hide: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const ActionSheetOption: React.FC<{
  option: ActionSheetOption;
  index: number;
  isFirst: boolean;
  optionStyle?: ViewStyle;
  optionTextStyle?: TextStyle;
  destructiveTextStyle?: TextStyle;
  onPress: (option: ActionSheetOption) => void;
  isInteractive: boolean;
  onFocusOption?: (index: number) => void;
}> = ({
  option,
  index,
  isFirst,
  optionStyle,
  optionTextStyle,
  destructiveTextStyle,
  onPress,
  isInteractive,
  onFocusOption,
}) => {
  const backgroundColor = useSharedValue("rgba(45, 45, 45, 0.95)");
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: backgroundColor.value,
    transform: [{ scale: scale.value }],
  }));

  const handleFocus = useCallback(() => {
    if (Platform.isTV) {
      backgroundColor.value = withSpring("rgba(147, 51, 233, 0.9)", {
        damping: 15,
        stiffness: 300,
      });
    }
    // Inform parent to auto-scroll on TV
    onFocusOption?.(index);
  }, [backgroundColor, onFocusOption, index]);

  const handleBlur = useCallback(() => {
    if (Platform.isTV) {
      backgroundColor.value = withSpring("rgba(45, 45, 45, 0.95)", {
        damping: 15,
        stiffness: 300,
      });
    }
  }, [backgroundColor]);

  const handlePressIn = useCallback(() => {
    if (!Platform.isTV && !option.disabled && isInteractive) {
      // Touch feedback for mobile
      backgroundColor.value = withTiming("rgba(147, 51, 233, 0.7)", {
        duration: 100,
      });
      scale.value = withTiming(0.96, {
        duration: 100,
      });
    }
  }, [backgroundColor, scale, option.disabled, isInteractive]);

  const handlePressOut = useCallback(() => {
    if (!Platform.isTV && !option.disabled && isInteractive) {
      // Reset touch feedback for mobile
      backgroundColor.value = withTiming("rgba(45, 45, 45, 0.95)", {
        duration: 150,
      });
      scale.value = withTiming(1, {
        duration: 150,
      });
    }
  }, [backgroundColor, scale, option.disabled, isInteractive]);

  const handlePress = useCallback(() => {
    if (!option.disabled && isInteractive) {
      onPress(option);
    }
  }, [option, onPress, isInteractive]);

  return (
    <Pressable
      key={index}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={option.disabled}
      hasTVPreferredFocus={isFirst && Platform.isTV}
      style={[
        {
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 8,
          marginBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          minHeight: 56,
          opacity: option.disabled ? 0.5 : 1,
        },
        optionStyle,
      ]}
    >
      <Animated.View
        style={[
          {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 16,
            paddingHorizontal: 20,
            borderRadius: 8,
            marginHorizontal: -20,
            marginVertical: -16,
          },
          animatedStyle,
        ]}
      >
        {option.icon && <View style={{ marginRight: 12 }}>{option.icon}</View>}
        <Text
          style={[
            {
              fontSize: 16,
              color: "white",
              textAlign: "center",
              flex: 1,
            },
            optionTextStyle,
            option.destructive && {
              color: "#ff453a",
              ...destructiveTextStyle,
            },
          ]}
        >
          {option.title}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

export const ModalActionSheet = forwardRef<ActionSheetRef, ActionSheetProps>(
  (
    {
      title,
      message,
      options,
      cancelButtonTitle = "Cancel",
      containerStyle,
      titleStyle,
      messageStyle,
      optionStyle,
      optionTextStyle,
      destructiveTextStyle,
      cancelButtonStyle,
      cancelButtonTextStyle,
      backdropOpacity = 0.6,
      animationDuration = 300,
      onCancel,
      onDismiss,
      visible: externalVisible,
    },
    ref,
  ) => {
    const [isAnimating, setIsAnimating] = useState(false);
    const [isInteractive, setIsInteractive] = useState(false);
    const translateY = useSharedValue(screenHeight);
    const opacity = useSharedValue(0);
    const cancelButtonRef = useRef<View>(null);

    // Use only external visibility control
    const visible = externalVisible || false;

    // Cancel button focus animation
    const cancelBackgroundColor = useSharedValue("rgba(60, 60, 60, 0.95)");
    const cancelScale = useSharedValue(1);

    const cancelAnimatedStyle = useAnimatedStyle(() => ({
      backgroundColor: cancelBackgroundColor.value,
      transform: [{ scale: cancelScale.value }],
    }));

    const handleCancelFocus = useCallback(() => {
      if (Platform.isTV) {
        cancelBackgroundColor.value = withSpring("rgba(147, 51, 233, 0.9)", {
          damping: 15,
          stiffness: 300,
        });
      }
    }, [cancelBackgroundColor]);

    const handleCancelBlur = useCallback(() => {
      if (Platform.isTV) {
        cancelBackgroundColor.value = withSpring("rgba(60, 60, 60, 0.95)", {
          damping: 15,
          stiffness: 300,
        });
      }
    }, [cancelBackgroundColor]);

    const handleCancelPressIn = useCallback(() => {
      if (!Platform.isTV && isInteractive) {
        // Touch feedback for mobile
        cancelBackgroundColor.value = withTiming("rgba(147, 51, 233, 0.7)", {
          duration: 100,
        });
        cancelScale.value = withTiming(0.96, {
          duration: 100,
        });
      }
    }, [cancelBackgroundColor, cancelScale, isInteractive]);

    const handleCancelPressOut = useCallback(() => {
      if (!Platform.isTV && isInteractive) {
        // Reset touch feedback for mobile
        cancelBackgroundColor.value = withTiming("rgba(60, 60, 60, 0.95)", {
          duration: 150,
        });
        cancelScale.value = withTiming(1, {
          duration: 150,
        });
      }
    }, [cancelBackgroundColor, cancelScale, isInteractive]);

    // Animated styles
    const backdropStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
    }));

    const containerAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
    }));

    const show = useCallback(() => {
      if (isAnimating) return;

      setIsAnimating(true);

      opacity.value = withTiming(backdropOpacity, {
        duration: animationDuration,
      });

      translateY.value = withSpring(
        0,
        {
          damping: 20,
          stiffness: 300,
        },
        () => {
          runOnJS(setIsAnimating)(false);
        },
      );
    }, [backdropOpacity, animationDuration, isAnimating]);

    const hide = useCallback(() => {
      if (isAnimating) return;

      setIsAnimating(true);

      opacity.value = withTiming(0, {
        duration: animationDuration,
      });

      translateY.value = withSpring(
        screenHeight,
        {
          damping: 20,
          stiffness: 300,
        },
        () => {
          runOnJS(setIsAnimating)(false);
          if (onDismiss) {
            runOnJS(onDismiss)();
          }
        },
      );
    }, [animationDuration, isAnimating, onDismiss, screenHeight]);

    const handleCancel = useCallback(() => {
      if (!isInteractive) {
        return;
      }
      hide();
      onCancel?.();
    }, [hide, onCancel, isInteractive]);

    const handleOptionPress = useCallback(
      (option: ActionSheetOption) => {
        hide();
        // Small delay to allow animation to start before executing the action
        setTimeout(() => {
          option.onPress();
        }, 50);
      },
      [hide],
    );

    const handleBackdropPress = useCallback(() => {
      if (!isInteractive) {
        return;
      }
      handleCancel();
    }, [handleCancel, isInteractive]);

    // Handle Android TV back button
    useEffect(() => {
      if (!visible || !Platform.isTV) return;

      const backAction = () => {
        handleCancel();
        return true;
      };

      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        backAction,
      );

      return () => backHandler.remove();
    }, [visible, handleCancel]);

    // Intercept tvOS Menu key so it doesn't trigger navigation, and cancel instead
    useTVEventHandler((evt) => {
      if (!visible || !Platform.isTV) return;
      if (evt?.eventType === "menu" || evt?.eventType === "back") {
        handleCancel();
      }
    });

    // When visible on tvOS, enable JS handling of the Menu key; disable when not visible
    useEffect(() => {
      if (Platform.isTV && Platform.OS === "ios") {
        try {
          if (visible) {
            TVEventControl.enableTVMenuKey?.();
          } else {
            TVEventControl.disableTVMenuKey?.();
          }
        } catch {}
        return () => {
          try {
            TVEventControl.disableTVMenuKey?.();
          } catch {}
        };
      }
    }, [visible]);

    // Simple animation when becoming visible
    useEffect(() => {
      if (visible) {
        setIsInteractive(false);
        translateY.value = screenHeight;
        opacity.value = 0;

        opacity.value = withTiming(backdropOpacity, {
          duration: animationDuration,
        });

        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
        });

        // Make modal interactive after animation completes + small delay
        setTimeout(() => {
          setIsInteractive(true);
        }, animationDuration + 200);
      } else {
        setIsInteractive(false);
      }
    }, [visible, backdropOpacity, animationDuration]);

    useImperativeHandle(ref, () => ({
      show,
      hide,
    }));
    // Ref for options ScrollView (used to auto-scroll to focused option on TV)
    const optionsScrollRef = useRef<ScrollView>(null);

    const scrollToOption = useCallback((idx: number) => {
      if (!Platform.isTV) return;
      // Approximate item height including spacing (minHeight 56 + margin 8)
      const ITEM_APPROX = 64;
      const targetY = Math.max(0, idx * ITEM_APPROX - ITEM_APPROX);
      optionsScrollRef.current?.scrollTo({ y: targetY, animated: true });
    }, []);

    if (!visible) {
      return null;
    }

    return (
      <Modal
        transparent
        visible={visible}
        animationType='none'
        onRequestClose={handleCancel}
        statusBarTranslucent
      >
        <View style={{ flex: 1 }}>
          {/* Backdrop */}
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "black",
              },
              backdropStyle,
            ]}
          />

          {/* Backdrop touchable area */}
          <Pressable
            style={{
              flex: 1,
              justifyContent: "flex-end",
              alignItems: "center",
            }}
            onPress={handleBackdropPress}
          >
            {/* Action Sheet Container */}
            <Animated.View
              style={[
                {
                  backgroundColor: "rgba(28, 28, 30, 0.98)",
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  paddingTop: 20,
                  paddingBottom: Platform.isTV ? 40 : 20,
                  paddingHorizontal: 20,
                  width: Platform.isTV
                    ? Math.min(600, screenWidth * 0.8)
                    : screenWidth,
                  maxHeight: screenHeight * 0.8,
                  shadowColor: "#000",
                  shadowOffset: {
                    width: 0,
                    height: -4,
                  },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 20,
                },
                containerStyle,
                containerAnimatedStyle,
              ]}
              // Prevent backdrop press when touching the sheet
              onStartShouldSetResponder={() => true}
            >
              {/* Title */}
              {title && (
                <Text
                  style={[
                    {
                      fontSize: 18,
                      fontWeight: "600",
                      color: "white",
                      textAlign: "center",
                      marginBottom: message ? 8 : 20,
                    },
                    titleStyle,
                  ]}
                >
                  {title}
                </Text>
              )}

              {/* Message */}
              {message && (
                <Text
                  style={[
                    {
                      fontSize: 14,
                      color: "rgba(255, 255, 255, 0.7)",
                      textAlign: "center",
                      marginBottom: 20,
                      lineHeight: 20,
                    },
                    messageStyle,
                  ]}
                >
                  {message}
                </Text>
              )}

              {/* Options (scrollable on TV) */}
              <ScrollView
                ref={optionsScrollRef}
                style={{ alignSelf: "stretch", maxHeight: screenHeight * 0.5 }}
                contentContainerStyle={{ paddingBottom: 16 }}
                showsVerticalScrollIndicator={!Platform.isTV}
              >
                {options.map((option, index) => (
                  <ActionSheetOption
                    key={index}
                    option={option}
                    index={index}
                    isFirst={index === 0}
                    optionStyle={optionStyle}
                    optionTextStyle={optionTextStyle}
                    destructiveTextStyle={destructiveTextStyle}
                    onPress={handleOptionPress}
                    isInteractive={isInteractive}
                    onFocusOption={scrollToOption}
                  />
                ))}
              </ScrollView>

              {/* Cancel Button */}
              <Pressable
                ref={cancelButtonRef}
                onPress={handleCancel}
                onPressIn={handleCancelPressIn}
                onPressOut={handleCancelPressOut}
                onFocus={handleCancelFocus}
                onBlur={handleCancelBlur}
                style={[
                  {
                    paddingVertical: 16,
                    paddingHorizontal: 20,
                    borderRadius: 8,
                    minHeight: 56,
                    justifyContent: "center",
                    alignItems: "center",
                  },
                  cancelButtonStyle,
                ]}
              >
                <Animated.View
                  style={[
                    {
                      paddingVertical: 16,
                      paddingHorizontal: 20,
                      borderRadius: 8,
                      minHeight: 56,
                      justifyContent: "center",
                      alignItems: "center",
                      marginHorizontal: -20,
                      marginVertical: -16,
                      width: "100%",
                    },
                    cancelAnimatedStyle,
                  ]}
                >
                  <Text
                    style={[
                      {
                        fontSize: 16,
                        color: "white",
                        fontWeight: "500",
                        textAlign: "center",
                      },
                      cancelButtonTextStyle,
                    ]}
                  >
                    {cancelButtonTitle}
                  </Text>
                </Animated.View>
              </Pressable>
            </Animated.View>
          </Pressable>
        </View>
      </Modal>
    );
  },
);

ModalActionSheet.displayName = "ModalActionSheet";
