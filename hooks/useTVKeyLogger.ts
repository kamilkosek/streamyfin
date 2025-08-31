import { useEffect, useRef } from "react";
import { Platform, useTVEventHandler } from "react-native";

// import { TVLogger } from "@/utils/TVLogger";

interface TVKeyLoggerOptions {
  enabled?: boolean;
  onLeftmostDetected?: () => void;
}

/**
 * Global TV key press logger - only active on TV platforms
 * Logs all key presses to console for debugging purposes
 * Detects when user reaches leftmost navigation boundary
 */
export const useTVKeyLogger = ({
  enabled = true,
  onLeftmostDetected,
}: TVKeyLoggerOptions = {}) => {
  const lastLeftEventRef = useRef<{ tag: number; timestamp: number } | null>(
    null,
  );
  const leftRepeatsRef = useRef(0);
  const focusChangeTracker = useRef<{
    lastFocusTag: number | null;
    leftPressCount: number;
  }>({
    lastFocusTag: null,
    leftPressCount: 0,
  });

  useEffect(() => {
    if (!Platform.isTV || !enabled) return;

    console.log("[TV Key Logger] Starting TV key press detection...");
  }, [enabled]);

  useTVEventHandler((evt) => {
    if (!Platform.isTV || !enabled || !evt) return;

    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];

    // Log the key press with detailed information
    console.log(`[TV Key Logger] ${timestamp} - Key pressed:`, {
      eventType: evt.eventType,
      tag: evt.tag,
      timestamp: new Date().toISOString(),
    });

    // Also log using the centralized TV logger
    // TVLogger.logKeyPress(evt.eventType, evt.tag);

    // Enhanced leftmost detection using multiple strategies
    if (evt.eventType === "left" && evt.tag !== undefined) {
      const now = Date.now();

      // Strategy 1: Repeated left presses on same tag (indicating no movement)
      if (
        lastLeftEventRef.current &&
        lastLeftEventRef.current.tag === evt.tag &&
        now - lastLeftEventRef.current.timestamp < 2000
      ) {
        // Within 2 seconds
        leftRepeatsRef.current++;
        console.log(
          `[TV Key Logger] Left repeat #${leftRepeatsRef.current} on tag ${evt.tag}`,
        );

        if (leftRepeatsRef.current >= 2) {
          console.log(
            "[TV Key Logger] Leftmost boundary detected (repeated left on same tag) - triggering drawer",
          );
          onLeftmostDetected?.();
          leftRepeatsRef.current = 0; // Reset counter
        }
      } else {
        leftRepeatsRef.current = 1;
      }

      lastLeftEventRef.current = { tag: evt.tag, timestamp: now };

      // Strategy 2: Track focus changes and left presses
      if (focusChangeTracker.current.lastFocusTag === evt.tag) {
        focusChangeTracker.current.leftPressCount++;
        if (focusChangeTracker.current.leftPressCount >= 3) {
          console.log(
            "[TV Key Logger] Leftmost boundary detected (no focus change after multiple lefts) - triggering drawer",
          );
          onLeftmostDetected?.();
          focusChangeTracker.current.leftPressCount = 0;
        }
      } else {
        focusChangeTracker.current.leftPressCount = 1;
      }
    } else if (evt.eventType === "focus" && evt.tag !== undefined) {
      // Track focus changes to detect when navigation stops working
      if (focusChangeTracker.current.lastFocusTag !== evt.tag) {
        focusChangeTracker.current.lastFocusTag = evt.tag;
        focusChangeTracker.current.leftPressCount = 0; // Reset left press count on focus change
      }
    } else if (evt.eventType !== "blur") {
      // Reset counters for other navigation events (but not blur, as it's part of focus change)
      leftRepeatsRef.current = 0;
      focusChangeTracker.current.leftPressCount = 0;
    }
  });
};
