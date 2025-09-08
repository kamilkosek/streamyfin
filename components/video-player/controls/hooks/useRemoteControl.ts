import { useCallback, useEffect, useRef, useState } from "react";
import { useTVEventHandler } from "react-native";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { msToTicks, ticksToSeconds } from "@/utils/time";
import { CONTROLS_CONSTANTS } from "../constants";

interface UseRemoteControlProps {
  progress: SharedValue<number>;
  min: SharedValue<number>;
  max: SharedValue<number>;
  isVlc: boolean;
  showControls: boolean;
  isPlaying: boolean;
  seek: (value: number) => void;
  play: () => void;
  togglePlay: () => void;
  toggleControls: () => void;
  calculateTrickplayUrl: (progressInTicks: number) => void;
  handleSeekForward: (seconds: number) => void;
  handleSeekBackward: (seconds: number) => void;
}

export function useRemoteControl({
  progress,
  min,
  max,
  isVlc,
  showControls,
  isPlaying,
  seek,
  play,
  togglePlay,
  toggleControls,
  calculateTrickplayUrl,
  handleSeekForward,
  handleSeekBackward,
}: UseRemoteControlProps) {
  const remoteScrubProgress = useSharedValue<number | null>(null);
  const isRemoteScrubbing = useSharedValue(false);
  const [showRemoteBubble, _setShowRemoteBubble] = useState(false);
  const [longPressScrubMode, _setLongPressScrubMode] = useState<
    "FF" | "RW" | null
  >(null);
  const [isSliding, setIsSliding] = useState(false);
  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const _SCRUB_INTERVAL = isVlc
    ? CONTROLS_CONSTANTS.SCRUB_INTERVAL_MS
    : CONTROLS_CONSTANTS.SCRUB_INTERVAL_TICKS;

  const _updateTime = useCallback(
    (progressValue: number) => {
      const progressInTicks = isVlc ? msToTicks(progressValue) : progressValue;
      const progressInSeconds = Math.floor(ticksToSeconds(progressInTicks));
      const hours = Math.floor(progressInSeconds / 3600);
      const minutes = Math.floor((progressInSeconds % 3600) / 60);
      const seconds = progressInSeconds % 60;
      setTime({ hours, minutes, seconds });
    },
    [isVlc],
  );

  useTVEventHandler((evt) => {
    if (!evt) return;
    if (__DEV__)
      console.log("userRemoteControl - show controls: ", showControls);
    if (!showControls) {
      toggleControls();
      return;
    }
    switch (evt.eventType) {
      case "longLeft": {
        break;
      }
      case "longRight": {
        break;
      }
      case "left":
      case "right": {
        break;
      }
      case "select": {
        break;
      }
      case "playPause": {
        togglePlay();
        break;
      }
      case "down":
        console.log("userRemoteControl - down");
        break;
      case "up":
        console.log("userRemoteControl - up");
        break;
      default:
        break;
    }

    // Always try to show controls if they're not shown
  });

  useEffect(() => {
    let isActive = true;
    let seekTime = CONTROLS_CONSTANTS.LONG_PRESS_INITIAL_SEEK;

    const scrubWithLongPress = () => {
      if (!isActive || !longPressScrubMode) return;

      setIsSliding(true);
      const scrubFn =
        longPressScrubMode === "FF" ? handleSeekForward : handleSeekBackward;
      scrubFn(seekTime);
      seekTime *= CONTROLS_CONSTANTS.LONG_PRESS_ACCELERATION;

      longPressTimeoutRef.current = setTimeout(
        scrubWithLongPress,
        CONTROLS_CONSTANTS.LONG_PRESS_INTERVAL,
      );
    };

    if (longPressScrubMode) {
      isActive = true;
      scrubWithLongPress();
    }

    return () => {
      isActive = false;
      setIsSliding(false);
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
    };
  }, [longPressScrubMode, handleSeekForward, handleSeekBackward]);

  return {
    remoteScrubProgress,
    isRemoteScrubbing,
    showRemoteBubble,
    longPressScrubMode,
    isSliding,
    time,
  };
}
