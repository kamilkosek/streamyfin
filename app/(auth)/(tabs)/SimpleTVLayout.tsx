import { MaterialIcons } from "@expo/vector-icons";
import { Slot, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
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
  // Suppress expand/collapse thrash that happens during navigation-induced focus churn
  const suppressFocusToggleUntilRef = useRef<number>(0);
  // Sticky-open state: stays expanded while any sidebar item is focused
  const [isStickyOpen, setIsStickyOpen] = useState(false);
  const isExpanded = isStickyOpen || isSidebarFocused;
  // Track the last focused sidebar item to restore focus on re-entry
  const [lastFocusedKey, setLastFocusedKey] = useState<string>("home");
  // When true, the next time focus enters the sidebar, we hint TV to give focus to lastFocusedKey
  const [restoreFocusOnNextEnter, setRestoreFocusOnNextEnter] = useState(false);
  // Ephemeral key used to set hasTVPreferredFocus only on re-entry and for a single render
  const [preferredFocusKey, setPreferredFocusKey] = useState<string | null>(
    null,
  );
  const prevSidebarFocusedRef = useRef<boolean>(false);
  const [focusRemountToken, setFocusRemountToken] = useState<number>(0);

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
    {
      key: "settings",
      // Settings page is currently under the Home tab group
      route: "/(auth)/(tabs)/(home)/settings",
      titleKey: "home.settings.settings_title",
      icon: "settings",
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

  const handleSidebarFocus = useCallback((itemKey?: string) => {
    // Ignore transient focus events during/just-after navigation
    if (Date.now() < suppressFocusToggleUntilRef.current) return;
    // Cancel any pending blur collapse
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    // Expand the sidebar when a sidebar item receives focus
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch {}
    setIsStickyOpen(true);
    setIsSidebarFocused(true);
    if (itemKey) setLastFocusedKey(itemKey);
    // We've re-entered the sidebar, so clear any pending restore hint
    setRestoreFocusOnNextEnter(false);
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
      // Collapse only if no other sidebar item regained focus within the debounce window
      setIsSidebarFocused(false);
      setIsStickyOpen(false);
      // Hint that on next re-entry we should restore focus to the last item
      setRestoreFocusOnNextEnter(true);
      blurTimeoutRef.current = null;
    }, 250); // Slightly longer delay for smoother, less jittery collapse
  }, []);

  const handleSidebarPress = useCallback(
    (route: string) => {
      // Navigate to the route
      navigateToRoute(route);

      // Suppress focus-driven expand during the route change so we don't jitter
      suppressFocusToggleUntilRef.current = Date.now() + 600; // short guard window
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
          // Suppress any focus churn from this programmatic navigation
          suppressFocusToggleUntilRef.current = Date.now() + 600;
          router.replace("/(auth)/(tabs)/(home)");
        }, 50);

        return () => clearTimeout(timer);
      }
    }
  }, [pathname, router]);

  // Also add a brief suppression when the pathname changes (covers deep links or external nav)
  useEffect(() => {
    suppressFocusToggleUntilRef.current = Math.max(
      suppressFocusToggleUntilRef.current,
      Date.now() + 400,
    );
  }, [pathname]);

  // Detect re-entry into the sidebar and apply preferred focus just once
  useEffect(() => {
    const prev = prevSidebarFocusedRef.current;
    let clear: any;
    if (isSidebarFocused && !prev && restoreFocusOnNextEnter) {
      // We're re-entering the sidebar: request preferred focus on last item
      setPreferredFocusKey(lastFocusedKey);
      setFocusRemountToken((c) => c + 1); // force remount of the target item so TV respects preferred focus
      setRestoreFocusOnNextEnter(false);
      // Clear after a short delay to avoid stealing subsequent focus
      clear = setTimeout(() => setPreferredFocusKey(null), 300);
    }
    prevSidebarFocusedRef.current = isSidebarFocused;
    return () => {
      if (clear) clearTimeout(clear);
    };
  }, [isSidebarFocused, restoreFocusOnNextEnter, lastFocusedKey]);

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
          isExpanded ? "w-48" : "w-16"
        }`}
      >
        <View className='flex-1 pt-0'>
          {/* Header - keep title mounted but hide when collapsed */}
          <View
            className={`flex-row items-center border-b-2 border-neutral-700 mb-4 h-16 ${
              isExpanded
                ? "justify-start px-4 py-0"
                : "justify-center px-2 py-0"
            }`}
          >
            <Image
              source={require("@/assets/images/icon-android-plain.png")}
              style={{ width: 40, height: 40 }}
              accessibilityLabel='Streamyfin icon'
            />
            {/* <Text
              className={`text-xl font-bold text-purple-600 ml-3 ${
                !isSidebarFocused ? "opacity-0 w-0 h-0" : ""
              }`}
            >
              Streamyfin
            </Text> */}
          </View>

          {/* Menu Items - keep Touchables mounted in both states */}
          <View className={`flex-1 pt-0 ${isExpanded ? "px-0" : "px-0"}`}>
            {menuItems.map((item) => {
              const isActive = isRouteActive(item.route);
              const tvFocusProps = Platform.isTV
                ? ({
                    hasTVPreferredFocus:
                      preferredFocusKey != null &&
                      preferredFocusKey === item.key,
                    focusable: true,
                  } as any)
                : undefined;

              const elementKey =
                preferredFocusKey === item.key && focusRemountToken
                  ? `${item.key}-pf-${focusRemountToken}`
                  : item.key;

              return (
                <TouchableOpacity
                  key={elementKey}
                  className={`flex-row items-center justify-start py-0 px-3 mb-0.5 rounded-lg relative bg-transparent min-h-[52px] w-full ${
                    isActive ? "bg-purple-600/15" : ""
                  }`}
                  onPress={() => {
                    setLastFocusedKey(item.key);
                    handleSidebarPress(item.route);
                  }}
                  onFocus={() => handleSidebarFocus(item.key)}
                  onBlur={handleSidebarBlur}
                  {...(tvFocusProps || {})}
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
                    } ${!isExpanded ? "opacity-0 w-0 h-0" : ""}`}
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
