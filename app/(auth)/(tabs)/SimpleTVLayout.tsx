import { MaterialIcons } from "@expo/vector-icons";
import { Slot, usePathname, useRouter, useSegments } from "expo-router";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Image,
  LayoutAnimation,
  Platform,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { apiAtom } from "@/providers/JellyfinProvider";
import { useSettings } from "@/utils/atoms/settings";
import { getPrimaryImageUrlById } from "@/utils/jellyfin/image/getPrimaryImageUrlById";

interface MenuItem {
  key: string;
  route?: string; // dynamic items may not have a route yet
  titleKey?: string; // translated label for built-ins
  title?: string; // raw label for dynamic items
  icon?: keyof typeof MaterialIcons.glyphMap; // legacy support
  imageIconUri?: string; // for dynamic items
}

export function TVDrawerLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const { settings, pluginSettings, refreshStreamyfinPluginSettings } =
    useSettings();
  const api = useAtomValue(apiAtom);
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
  const menuListRef = useRef<FlatList<MenuItem>>(null);
  const ITEM_HEIGHT = 56; // approx row height (min-h-52 + paddings)

  // Dev logger helper
  const devLog = useCallback((...args: any[]) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[TVDrawer]", ...args);
    }
  }, []);

  // Try to fetch plugin settings on mount (and when function identity changes)
  useEffect(() => {
    if (Platform.isTV) {
      (async () => {
        try {
          await refreshStreamyfinPluginSettings?.();
        } catch (e) {
          devLog("plugin settings refresh error", e);
        }
      })();
    }
  }, [refreshStreamyfinPluginSettings]);

  const baseBefore: MenuItem[] = [
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

  const rawTvLinks =
    settings?.tvSidebarLinks ?? pluginSettings?.tvSidebarLinks?.value;
  const dynamicIds = new Set(
    Array.isArray(rawTvLinks)
      ? rawTvLinks
          .filter((l) => !!l && typeof l.id === "string" && l.id.length > 0)
          .map((l) => l.id)
      : [],
  );
  devLog("dynamicIds", Array.from(dynamicIds));
  const dynamicTvItems: MenuItem[] = Array.isArray(rawTvLinks)
    ? rawTvLinks
        .filter(
          (l) =>
            !!l &&
            typeof l.name === "string" &&
            typeof l.id === "string" &&
            l.id.length > 0,
        )
        .map((l, idx) => {
          const route =
            l.type === "collection"
              ? `/((auth))/(tabs)/(libraries)/collections/${l.id}`.replace(
                  "((auth))",
                  "(auth)",
                )
              : l.type === "library"
                ? `/((auth))/(tabs)/(libraries)/${l.id}`.replace(
                    "((auth))",
                    "(auth)",
                  )
                : undefined;

          return {
            key: `tvlink-${l.id || idx}`,
            route,
            title: l.name,
            imageIconUri:
              l.icon ||
              getPrimaryImageUrlById({
                api,
                id: l.id,
                width: 64,
                quality: 90,
              }) ||
              undefined,
          };
        })
    : [];

  // Static items after dynamic links
  const baseAfter: MenuItem[] = [
    {
      key: "settings",
      // Settings page is currently under the Home tab group
      route: "/(auth)/(tabs)/(home)/settings",
      titleKey: "home.settings.settings_title",
      icon: "settings",
    },
  ];

  const menuItems: MenuItem[] = [
    ...baseBefore,
    ...dynamicTvItems,
    ...baseAfter,
  ];

  const navigateToRoute = useCallback(
    (route: string) => {
      devLog("navigateToRoute", { from: pathname, to: route });
      router.push(route as any);
    },
    [router, pathname, devLog],
  );

  const isRouteActive = useCallback(
    (route?: string) => {
      if (!route) return false;
      const norm = (p: string) =>
        p
          .split("/")
          .filter(Boolean)
          .map((s) => s.replace(/[()]/g, ""));

      const routeSegs = norm(route);
      const underlyingId = routeSegs[routeSegs.length - 1];
      const isDynamicTvLink =
        route.includes("/collections/") || /\/libraries\/(?!$)/.test(route);

      // Segments from hook (include group placeholders & dynamic param placeholders)
      const segsFromHook = Array.isArray(segments)
        ? (segments as string[])
        : [];
      const segsNormalized = segsFromHook.map((s) => s.replace(/[()]/g, ""));

      // Fallback actual path (contains real param IDs but omits group segments)
      const pathFallbackSegs = norm(pathname || "");

      // Build a merged view: prefer segsNormalized for structural position (groups),
      // use fallback for actual id value if last segment in segsNormalized is a param placeholder
      const afterTabsIdx = segsNormalized.indexOf("tabs");
      const afterTabsRaw =
        afterTabsIdx >= 0
          ? segsNormalized.slice(afterTabsIdx + 1)
          : segsNormalized;

      // Determine actual id from fallback path (last part if looks like hex or length > 5)
      const fallbackLast = pathFallbackSegs[pathFallbackSegs.length - 1];
      const pathLooksLikeId = /[0-9a-fA-F]{8,}/.test(fallbackLast || "");
      const actualId = pathLooksLikeId ? fallbackLast : undefined;

      // Library root active only when we are exactly on libraries (no deeper segments)
      if (
        (!isDynamicTvLink && route.endsWith("/(libraries)")) ||
        routeSegs[routeSegs.length - 1] === "libraries"
      ) {
        const librariesIdx = afterTabsRaw.indexOf("libraries");
        if (librariesIdx >= 0) {
          const deeper = afterTabsRaw.length > librariesIdx + 1;
          if (!deeper) {
            devLog("isRouteActive", { route, reason: "exact libraries" });
            return true;
          }
        }
      }

      // Dynamic collection match: structure has 'libraries','collections', placeholder; actualId matches underlyingId
      let dynamicMatch = false;
      if (isDynamicTvLink) {
        const hasCollections = afterTabsRaw.includes("collections");
        if (route.includes("/collections/") && hasCollections) {
          // Only highlight the one whose route id matches the current path id
          dynamicMatch = underlyingId === actualId;
        } else if (
          route.includes("/libraries/") &&
          !route.includes("/collections/")
        ) {
          // dynamic library link
          const hasLibraries = afterTabsRaw.includes("libraries");
          if (hasLibraries) {
            // Only highlight the one whose route id matches the current path id
            dynamicMatch = underlyingId === actualId;
          }
        }
      }

      // Non-dynamic base items (home/search/favorites/settings)
      if (!isDynamicTvLink) {
        const candidateKey = routeSegs[routeSegs.length - 1];
        const isBase = ["home", "search", "favorites", "settings"].includes(
          candidateKey,
        );
        if (isBase) {
          const active =
            afterTabsRaw.includes(candidateKey) ||
            pathFallbackSegs[0] === candidateKey;
          devLog("isRouteActive", {
            route,
            base: candidateKey,
            active,
            afterTabsRaw,
            pathFallbackSegs,
          });
          return active;
        }
      }

      devLog("isRouteActive", {
        route,
        pathname,
        segsNormalized,
        afterTabsRaw,
        pathFallbackSegs,
        underlyingId,
        actualId,
        isDynamicTvLink,
        dynamicMatch,
        dynamicIds: Array.from(dynamicIds),
      });
      return dynamicMatch;
    },
    [pathname, segments, menuItems, devLog, dynamicIds],
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
    devLog("onFocus sidebar item", { itemKey, pathname });
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
    devLog("onBlur sidebar", { pathname });
  }, []);

  const handleSidebarPress = useCallback(
    (route: string) => {
      // Navigate to the route
      navigateToRoute(route);

      // Suppress focus-driven expand during the route change so we don't jitter
      suppressFocusToggleUntilRef.current = Date.now() + 600; // short guard window
      devLog("onPress sidebar item", { to: route });
    },
    [navigateToRoute, devLog],
  );

  useEffect(() => {
    // Enable LayoutAnimation on Android when available
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    devLog("mount TVDrawerLayout");
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      devLog("unmount TVDrawerLayout");
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
          router.replace("/(auth)/(tabs)/(home)" as any);
          devLog("replace to home on TV root");
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
    devLog("pathname changed", pathname);
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

  // If we have a preferred focus key (restoring focus), ensure it's visible by scrolling it into view
  useEffect(() => {
    if (!preferredFocusKey) return;
    const idx = menuItems.findIndex((mi) => mi.key === preferredFocusKey);
    if (idx >= 0) {
      // tiny delay to allow list layout
      const t = setTimeout(() => {
        try {
          menuListRef.current?.scrollToIndex({
            index: idx,
            animated: true,
            viewPosition: 0.5,
          });
        } catch {}
      }, 0);
      return () => clearTimeout(t);
    }
  }, [preferredFocusKey, menuItems]);

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
          isExpanded ? "w-48" : "w-18"
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
            <FlatList
              ref={menuListRef}
              data={menuItems}
              keyExtractor={(it) => it.key}
              renderItem={({ item, index }) => {
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
                    className={`flex-row items-center justify-start py-0 px-4 mb-0.5 rounded-lg relative bg-transparent min-h-[52px] w-full ${
                      isActive ? "bg-purple-600/15" : ""
                    }`}
                    onPress={() => {
                      setLastFocusedKey(item.key);
                      // Keep focus on the sidebar item so visual state matches Settings
                      setPreferredFocusKey(item.key);
                      setFocusRemountToken((c) => c + 1);
                      if (item.route) {
                        handleSidebarPress(item.route);
                      } else {
                        devLog(
                          "onPress dynamic tvSidebarLinks item (no route yet)",
                          item,
                        );
                      }
                    }}
                    onFocus={() => {
                      handleSidebarFocus(item.key);
                      try {
                        menuListRef.current?.scrollToIndex({
                          index,
                          viewPosition: 0.5,
                          animated: true,
                        });
                      } catch {}
                    }}
                    onBlur={handleSidebarBlur}
                    {...(tvFocusProps || {})}
                    accessibilityLabel={
                      item.titleKey ? t(item.titleKey) : item.title
                    }
                    accessibilityRole='button'
                  >
                    <View className='mr-3'>
                      {item.imageIconUri ? (
                        <Image
                          source={{ uri: item.imageIconUri }}
                          style={{ width: 24, height: 24, borderRadius: 4 }}
                          resizeMode='cover'
                        />
                      ) : (
                        <MaterialIcons
                          name={(item.icon as any) || "link"}
                          size={24}
                          color={isActive ? "#9334E9" : "#fff"}
                        />
                      )}
                    </View>

                    <Text
                      className={`text-base font-medium text-white flex-1 ${
                        isActive ? "text-purple-600 font-semibold" : ""
                      } ${!isExpanded ? "opacity-0 w-0 h-0" : ""}`}
                    >
                      {item.titleKey ? t(item.titleKey) : item.title}
                    </Text>

                    {isActive && (
                      <View className='absolute left-0 top-0 bottom-0 w-1 bg-purple-600 rounded-sm' />
                    )}
                  </TouchableOpacity>
                );
              }}
              getItemLayout={(_data, index) => ({
                length: ITEM_HEIGHT,
                offset: ITEM_HEIGHT * index,
                index,
              })}
              onScrollToIndexFailed={(info) => {
                try {
                  const offset =
                    (info.averageItemLength || ITEM_HEIGHT) * info.index;
                  menuListRef.current?.scrollToOffset({
                    offset,
                    animated: true,
                  });
                  setTimeout(() => {
                    try {
                      menuListRef.current?.scrollToIndex({
                        index: info.index,
                        viewPosition: 0.5,
                        animated: true,
                      });
                    } catch {}
                  }, 50);
                } catch {}
              }}
            />
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
