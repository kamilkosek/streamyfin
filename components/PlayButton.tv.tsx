import { Ionicons } from "@expo/vector-icons";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { useRouter } from "expo-router";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { FocusableItem } from "@/components/common/FocusableItem";
import { useHaptic } from "@/hooks/useHaptic";
import { itemThemeColorAtom } from "@/utils/atoms/primaryColor";
import { useSettings } from "@/utils/atoms/settings";
import { runtimeTicksToMinutes } from "@/utils/time";
import type { Button } from "./Button";
import type { SelectedOptions } from "./ItemContent";

interface Props extends React.ComponentProps<typeof Button> {
  item: BaseItemDto;
  selectedOptions: SelectedOptions;
}

const ANIMATION_DURATION = 500;
// Removed width/progress bar for TV round-buttons UI

export const PlayButton: React.FC<Props> = ({
  item,
  selectedOptions,
}: Props) => {
  const [colorAtom] = useAtom(itemThemeColorAtom);

  const router = useRouter();

  const endColor = useSharedValue(colorAtom);
  const startColor = useSharedValue(colorAtom);
  const colorChangeProgress = useSharedValue(0);
  const { settings, updateSettings } = useSettings();
  const lightHapticFeedback = useHaptic("light");

  const goToPlayer = useCallback(
    (q: string) => {
      if (settings.maxAutoPlayEpisodeCount.value !== -1) {
        updateSettings({ autoPlayEpisodeCount: 0 });
      }
      router.push(`/player/direct-player?${q}`);
    },
    [router, settings, updateSettings],
  );

  const handlePlayFromBeginning = () => {
    if (!item) return;
    lightHapticFeedback();
    const queryParams = new URLSearchParams({
      itemId: item.Id!,
      audioIndex: selectedOptions.audioIndex?.toString() ?? "",
      subtitleIndex: selectedOptions.subtitleIndex?.toString() ?? "",
      mediaSourceId: selectedOptions.mediaSource?.Id ?? "",
      bitrateValue: selectedOptions.bitrate?.value?.toString() ?? "",
      playbackPosition: "0",
    });
    goToPlayer(queryParams.toString());
  };

  const handleResume = () => {
    if (!item) return;
    lightHapticFeedback();
    const queryParams = new URLSearchParams({
      itemId: item.Id!,
      audioIndex: selectedOptions.audioIndex?.toString() ?? "",
      subtitleIndex: selectedOptions.subtitleIndex?.toString() ?? "",
      mediaSourceId: selectedOptions.mediaSource?.Id ?? "",
      bitrateValue: selectedOptions.bitrate?.value?.toString() ?? "",
      playbackPosition: item.UserData?.PlaybackPositionTicks?.toString() ?? "0",
    });
    goToPlayer(queryParams.toString());
  };

  // No width animation for the round buttons UI

  useAnimatedReaction(
    () => colorAtom,
    (newColor) => {
      endColor.value = newColor;
      colorChangeProgress.value = 0;
      colorChangeProgress.value = withTiming(1, {
        duration: ANIMATION_DURATION,
        easing: Easing.bezier(0.9, 0, 0.31, 0.99),
      });
    },
    [colorAtom],
  );

  useEffect(() => {
    const timeout_2 = setTimeout(() => {
      startColor.value = colorAtom;
    }, ANIMATION_DURATION);

    return () => {
      clearTimeout(timeout_2);
    };
  }, [colorAtom, item]);

  /**
   * ANIMATED STYLES
   */
  // Keep only text color animation to match theme

  const animatedTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      colorChangeProgress.value,
      [0, 1],
      [startColor.value.text, endColor.value.text],
    ),
  }));
  /**
   * *********************
   */

  const playbackPositionTicks = item?.UserData?.PlaybackPositionTicks ?? 0;
  const hasResume = !!playbackPositionTicks && playbackPositionTicks > 0;
  const [isPlayFocused, setIsPlayFocused] = useState(false);
  const [isResumeFocused, setIsResumeFocused] = useState(false);

  return (
    <View className='flex flex-row items-center space-x-4 w-full'>
      <FocusableItem
        onPress={handlePlayFromBeginning}
        className='pl-2 flex-1 rounded-xl'
        borderOnFocus={false}
        hasTVPreferredFocus
        onFocus={() => setIsPlayFocused(true)}
        onBlur={() => setIsPlayFocused(false)}
      >
        <View
          className='flex flex-row items-center h-12 px-5 rounded-xl w-full'
          style={{
            // Focused: white background, 2px purple border; Unfocused: light gray background
            backgroundColor: isPlayFocused ? "#FFFFFF" : "#2A2A2A",
            borderWidth: 2,
            borderColor: isPlayFocused ? colorAtom.primary : "transparent",
          }}
        >
          <Animated.Text
            style={[
              animatedTextStyle,
              // Focused text/icon should be black on white background
              isPlayFocused ? { color: "#000000" } : null,
            ]}
          >
            <Ionicons name='play' size={22} />
          </Animated.Text>
          <Animated.Text
            style={[
              animatedTextStyle,
              { marginLeft: 8, fontWeight: "600" },
              isPlayFocused ? { color: "#000000" } : null,
            ]}
          >
            Play
          </Animated.Text>
          <Animated.Text
            style={[
              animatedTextStyle,
              { marginLeft: 8, opacity: 0.8, fontSize: 12 },
              isPlayFocused ? { color: "#000000" } : null,
            ]}
          >
            {runtimeTicksToMinutes(item?.RunTimeTicks)}
          </Animated.Text>
        </View>
      </FocusableItem>

      {hasResume && (
        <FocusableItem
          onPress={handleResume}
          className='flex-1 rounded-xl'
          borderOnFocus={false}
          onFocus={() => setIsResumeFocused(true)}
          onBlur={() => setIsResumeFocused(false)}
        >
          <View
            className='flex flex-row items-center h-12 px-5 rounded-xl w-full'
            style={{
              backgroundColor: isResumeFocused ? "#FFFFFF" : "#2A2A2A",
              borderWidth: 2,
              borderColor: isResumeFocused ? colorAtom.primary : "transparent",
            }}
          >
            <Animated.Text
              style={[
                animatedTextStyle,
                isResumeFocused ? { color: "#000000" } : null,
              ]}
            >
              <Ionicons name='play-forward' size={22} />
            </Animated.Text>
            <Animated.Text
              style={[
                animatedTextStyle,
                { marginLeft: 8, fontWeight: "600" },
                isResumeFocused ? { color: "#000000" } : null,
              ]}
            >
              Continue at {runtimeTicksToMinutes(playbackPositionTicks)}
            </Animated.Text>
          </View>
        </FocusableItem>
      )}
    </View>
  );
};
