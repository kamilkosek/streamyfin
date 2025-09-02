import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import type { PropsWithChildren } from "react";
import { Platform, type TouchableOpacityProps } from "react-native";
import { FocusableItem } from "@/components/common/FocusableItem";
import { useHaptic } from "@/hooks/useHaptic";

interface Props extends TouchableOpacityProps {
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  background?: boolean;
  size?: "default" | "large";
  fillColor?: "primary";
  hapticFeedback?: boolean;
}

export const RoundButton: React.FC<PropsWithChildren<Props>> = ({
  background = true,
  icon,
  onPress,
  children,
  size = "default",
  fillColor,
  hapticFeedback = true,
}) => {
  const buttonSize = size === "large" ? "h-10 w-10" : "h-9 w-9";
  const fillColorClass = fillColor === "primary" ? "bg-purple-600" : "";
  const lightHapticFeedback = useHaptic("light");

  const handlePress = () => {
    if (hapticFeedback) {
      lightHapticFeedback();
    }
    onPress?.();
  };

  if (fillColor)
    return (
      <FocusableItem
        onPress={handlePress}
        className={`rounded-full ${buttonSize} flex items-center justify-center ${fillColorClass}`}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={size === "large" ? 22 : 18}
            color={"white"}
          />
        ) : null}
        {children ? children : null}
      </FocusableItem>
    );

  if (background === false)
    return (
      <FocusableItem
        onPress={handlePress}
        className={`rounded-full ${buttonSize} flex items-center justify-center ${fillColorClass}`}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={size === "large" ? 22 : 18}
            color={"white"}
          />
        ) : null}
        {children ? children : null}
      </FocusableItem>
    );

  if (Platform.OS === "android")
    return (
      <FocusableItem
        onPress={handlePress}
        className={`rounded-full ${buttonSize} flex items-center justify-center ${
          fillColor ? fillColorClass : "bg-neutral-800/80"
        }`}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={size === "large" ? 22 : 18}
            color={"white"}
          />
        ) : null}
        {children ? children : null}
      </FocusableItem>
    );

  return (
    <FocusableItem onPress={handlePress}>
      <BlurView
        intensity={90}
        className={`rounded-full overflow-hidden ${buttonSize} flex items-center justify-center ${fillColorClass}`}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={size === "large" ? 22 : 18}
            color={"white"}
          />
        ) : null}
        {children ? children : null}
      </BlurView>
    </FocusableItem>
  );
};
