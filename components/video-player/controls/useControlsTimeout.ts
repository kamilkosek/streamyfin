import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { CONTROLS_CONSTANTS } from "./constants";

interface UseControlsTimeoutProps {
  showControls: boolean;
  isSliding: boolean;
  episodeView: boolean;
  onHideControls: () => void;
  timeout?: number;
  isPlaying?: boolean;
}

export const useControlsTimeout = ({
  showControls,
  isSliding,
  episodeView,
  onHideControls,
  timeout = 4000,
  isPlaying = true,
}: UseControlsTimeoutProps) => {
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate effective timeout based on platform and playback state
  const getEffectiveTimeout = () => {
    if (Platform.isTV) {
      return isPlaying
        ? CONTROLS_CONSTANTS.TIMEOUT
        : CONTROLS_CONSTANTS.TIMEOUT_TV;
    }
    return timeout;
  };

  const resetTimeout = useCallback(() => {
    if (showControls && !isSliding && !episodeView) {
      if (__DEV__) console.log("resetTimeout - resetting timeout");
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      const effectiveTimeout = isPlaying
        ? Platform.isTV
          ? CONTROLS_CONSTANTS.TIMEOUT
          : timeout
        : Platform.isTV
          ? CONTROLS_CONSTANTS.TIMEOUT_TV
          : timeout;
      controlsTimeoutRef.current = setTimeout(() => {
        onHideControls();
      }, effectiveTimeout);
    }
  }, [
    showControls,
    isSliding,
    episodeView,
    onHideControls,
    isPlaying,
    timeout,
  ]);

  useEffect(() => {
    const resetControlsTimeout = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }

      if (showControls && !isSliding && !episodeView) {
        const effectiveTimeout = getEffectiveTimeout();
        controlsTimeoutRef.current = setTimeout(() => {
          onHideControls();
        }, effectiveTimeout);
      }
    };

    resetControlsTimeout();

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [
    showControls,
    isSliding,
    episodeView,
    timeout,
    onHideControls,
    isPlaying,
  ]);

  const handleControlsInteraction = () => {
    if (showControls) {
      if (__DEV__) console.log("handleControlsInteraction - resetting timeout");
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      const effectiveTimeout = getEffectiveTimeout();
      controlsTimeoutRef.current = setTimeout(() => {
        onHideControls();
      }, effectiveTimeout);
    }
  };

  return {
    handleControlsInteraction,
    resetTimeout,
  };
};
