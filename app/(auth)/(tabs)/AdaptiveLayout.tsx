import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Platform } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { storage } from "@/utils/mmkv";
import { TVDrawerLayout } from "./SimpleTVLayout";
// Import both layouts
import { TabLayout } from "./TabLayout";

export default function AdaptiveLayout() {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      // Skip intro check for TV platforms
      if (Platform.isTV) {
        return;
      }

      const hasShownIntro = storage.getBoolean("hasShownIntro");
      if (!hasShownIntro) {
        const timer = setTimeout(() => {
          router.push("/intro/page");
        }, 1000);

        return () => {
          clearTimeout(timer);
        };
      }
    }, [router]),
  );

  return (
    <>
      <SystemBars hidden={false} style='light' />
      {Platform.isTV ? <TVDrawerLayout /> : <TabLayout />}
    </>
  );
}
