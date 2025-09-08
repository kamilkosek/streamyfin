import { useEffect, useRef } from "react";
import { findNodeHandle, Platform } from "react-native";

/**
 * Hook to request TV focus for a specific view
 * This is crucial for TV apps to receive remote control events
 */
export function useTVFocus() {
  const viewRef = useRef<any>(null);

  useEffect(() => {
    if (!Platform.isTV) return;

    const requestFocus = () => {
      try {
        if (viewRef.current) {
          const reactTag = findNodeHandle(viewRef.current);
          if (reactTag) {
            console.log(
              "[useTVFocus] Requesting focus for view, reactTag:",
              reactTag,
            );
            // Try to focus the view
            viewRef.current.focus?.();

            // Also try requestFocus if available
            if (viewRef.current.requestFocus) {
              viewRef.current.requestFocus();
            }
          }
        }
      } catch (error) {
        console.warn("[useTVFocus] Error requesting focus:", error);
      }
    };

    // Request focus immediately and after a delay
    requestFocus();
    const timeout = setTimeout(requestFocus, 1000);

    return () => clearTimeout(timeout);
  }, []);

  return viewRef;
}
