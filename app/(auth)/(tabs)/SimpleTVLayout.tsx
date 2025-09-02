import { MaterialIcons } from "@expo/vector-icons";
import { Slot, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutAnimation,
  Platform,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";

interface MenuItem {
  key: string;
  route: string;
  titleKey: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

export function TVDrawerLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarFocused, setIsSidebarFocused] = useState(false); // Start collapsed
  const blurTimeoutRef = useRef<any>(null);

  const menuItems: MenuItem[] = [
    {
      key: "home",
      route: "/(auth)/(tabs)/(home)",
      titleKey: "tabs.home",
      icon: "home",
    },
    {
      key: "search",
      route: "/(auth)/(tabs)/(search)",
      titleKey: "tabs.search",
      icon: "search",
    },
    {
      key: "favorites",
      route: "/(auth)/(tabs)/(favorites)",
      titleKey: "tabs.favorites",
      icon: "favorite",
    },
    {
      key: "libraries",
      route: "/(auth)/(tabs)/(libraries)",
      titleKey: "tabs.library",
      icon: "video-library",
    },
  ];

  const navigateToRoute = useCallback(
    (route: string) => {
      router.push(route as any);
    },
    [router],
  );

  const isRouteActive = useCallback(
    (route: string) => {
      // More robust route matching for the TV layout
      const routeSegments = route.split("/").filter(Boolean);

      // Check if the pathname contains the tab name from the route
      const tabName = routeSegments[routeSegments.length - 1]?.replace(
        /[()]/g,
        "",
      );
      return tabName && pathname.includes(tabName);
    },
    [pathname],
  );

  const handleSidebarFocus = useCallback(() => {
    // Cancel any pending blur collapse
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    // Expand the sidebar when a sidebar item receives focus
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch {}
    setIsSidebarFocused(true);
  }, []);

  const handleSidebarBlur = useCallback(() => {
    // Small delay to allow navigation between sidebar items
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }

    blurTimeoutRef.current = setTimeout(() => {
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch {}
      setIsSidebarFocused(false);
      blurTimeoutRef.current = null;
    }, 100); // Shorter delay for quicker collapse
  }, []);

  const handleSidebarPress = useCallback(
    (route: string) => {
      // Navigate to the route
      navigateToRoute(route);

      // Force collapse the sidebar immediately after navigation
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }

      // Immediate collapse after press
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch {}
      setIsSidebarFocused(false);
    },
    [navigateToRoute],
  );

  useEffect(() => {
    // Enable LayoutAnimation on Android when available
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    };
  }, []);

  // Navigate to home screen on initial load for TV
  useEffect(() => {
    if (Platform.isTV) {
      // Check if we're at the root tabs route
      const isAtRootTabs =
        !pathname ||
        pathname === "/" ||
        pathname === "/(auth)/(tabs)" ||
        pathname === "/(auth)/(tabs)/" ||
        pathname.endsWith("/(tabs)");

      if (isAtRootTabs) {
        // Use a small delay to ensure the layout is ready
        const timer = setTimeout(() => {
          router.replace("/(auth)/(tabs)/(home)");
        }, 50);

        return () => clearTimeout(timer);
      }
    }
  }, [pathname, router]);

  // Only show this layout on TV platforms
  if (!Platform.isTV) {
    return (
      <View className='flex-1'>
        <Slot />
      </View>
    );
  }

  return (
    <View className='flex-1 flex-row bg-black'>
      {/* Focus-Responsive Sidebar - single mounted tree to avoid remount/focus jumps */}
      <View
        className={`bg-neutral-800 border-r border-neutral-700 shadow-2xl ${
          isSidebarFocused ? "w-48" : "w-16"
        }`}
      >
        <View className='flex-1 pt-0'>
          {/* Header - keep title mounted but hide when collapsed */}
          <View
            className={`flex-row items-center border-b-2 border-neutral-700 mb-4 h-16 ${
              isSidebarFocused
                ? "justify-start px-4 py-0"
                : "justify-center px-2 py-0"
            }`}
          >
            <MaterialIcons name='tv' size={24} color='#9334E9' />
            <Text
              className={`text-xl font-bold text-purple-600 ml-3 ${
                !isSidebarFocused ? "opacity-0 w-0 h-0" : ""
              }`}
            >
              Streamyfin
            </Text>
          </View>

          {/* Menu Items - keep Touchables mounted in both states */}
          <View className={`flex-1 pt-0 ${isSidebarFocused ? "px-0" : "px-0"}`}>
            {menuItems.map((item) => {
              const isActive = isRouteActive(item.route);

              return (
                <TouchableOpacity
                  key={item.key}
                  className={`flex-row items-center justify-start py-0 px-3 mb-0.5 rounded-lg relative bg-transparent min-h-[52px] w-full ${
                    isActive ? "bg-purple-600/15" : ""
                  }`}
                  onPress={() => handleSidebarPress(item.route)}
                  onFocus={handleSidebarFocus}
                  onBlur={handleSidebarBlur}
                  accessibilityLabel={t(item.titleKey)}
                  accessibilityRole='button'
                >
                  <View className='mr-3'>
                    <MaterialIcons
                      name={item.icon}
                      size={24}
                      color={isActive ? "#9334E9" : "#fff"}
                    />
                  </View>

                  <Text
                    className={`text-base font-medium text-white flex-1 ${
                      isActive ? "text-purple-600 font-semibold" : ""
                    } ${!isSidebarFocused ? "opacity-0 w-0 h-0" : ""}`}
                  >
                    {t(item.titleKey)}
                  </Text>

                  {isActive && (
                    <View className='absolute left-0 top-0 bottom-0 w-1 bg-purple-600 rounded-sm' />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* collapsed navigation hint - still mounted but hidden when expanded/collapsed via styles */}
          <View
            className='mt-auto pt-4 items-center justify-center opacity-60'
            pointerEvents='none'
          >
            <MaterialIcons name='keyboard-arrow-right' size={16} color='#666' />
          </View>
        </View>
      </View>

      {/* Main Content */}
      <View className='flex-1 bg-black'>
        <Slot />
      </View>
    </View>
  );
}
