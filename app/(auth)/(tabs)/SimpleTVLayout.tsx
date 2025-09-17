import { MaterialIcons } from "@expo/vector-icons";
import { Slot, usePathname, useRouter, useSegments } from "expo-router";
import { useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  // Derived metadata (for fast active-key checks)
  routeType?: "base" | "libraries-root" | "library" | "collection";
  underlyingId?: string;
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

  // Fetch plugin settings once on mount (no runtime updates)
  useEffect(() => {
    if (!Platform.isTV) return;
    (async () => {
      try {
        await refreshStreamyfinPluginSettings?.();
      } catch (e) {
        devLog("plugin settings refresh error", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baseBefore: MenuItem[] = [
    {
      key: "home",
      route: "/(auth)/(tabs)/(home)",
      titleKey: "tabs.home",
      icon: "home",
      routeType: "base",
    },
    {
      key: "search",
      route: "/(auth)/(tabs)/(search)",
      titleKey: "tabs.search",
      icon: "search",
      routeType: "base",
    },
    {
      key: "favorites",
      route: "/(auth)/(tabs)/(favorites)",
      titleKey: "tabs.favorites",
      icon: "favorite",
      routeType: "base",
    },
    {
      key: "libraries",
      route: "/(auth)/(tabs)/(libraries)",
      titleKey: "tabs.library",
      icon: "video-library",
      routeType: "libraries-root",
    },
  ];

  const rawTvLinks =
    settings?.tvSidebarLinks ?? pluginSettings?.tvSidebarLinks?.value;
  const didFreezeDynamicRef = useRef(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([...baseBefore]);
  // Insert baseAfter at the end when rendering to avoid re-creating arrays; we'll append visually

  // Static items after dynamic links
  const baseAfter: MenuItem[] = [
    {
      key: "settings",
      // Settings page is currently under the Home tab group
      route: "/(auth)/(tabs)/(home)/settings",
      titleKey: "home.settings.settings_title",
      icon: "settings",
      routeType: "base",
    },
  ];

  // Freeze dynamic items once when links become available
  useEffect(() => {
    if (didFreezeDynamicRef.current) return;
    if (!Array.isArray(rawTvLinks)) return;
    const dynamicTvItems: MenuItem[] = rawTvLinks
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
        // Build image URL only if API is ready and result is valid
        let imageIconUri: string | undefined = l.icon || undefined;
        if (!imageIconUri && api) {
          try {
            const u = getPrimaryImageUrlById({
              api,
              id: l.id,
              width: 64,
              quality: 90,
            });
            if (u && !String(u).startsWith("undefined")) imageIconUri = u;
          } catch {}
        }

        return {
          key: `tvlink-${l.id || idx}`,
          route,
          title: l.name,
          imageIconUri,
          routeType:
            l.type === "collection"
              ? "collection"
              : l.type === "library"
                ? "library"
                : undefined,
          underlyingId: l.id,
        } as MenuItem;
      });
    setMenuItems([...baseBefore, ...dynamicTvItems]);
    didFreezeDynamicRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTvLinks, api]);

  const navigateToRoute = useCallback(
    (route: string) => {
      devLog("navigateToRoute", { from: pathname, to: route });
      router.push(route as any);
    },
    [router, pathname, devLog],
  );
  // Compute active key once per path change
  const pathMeta = useMemo(() => {
    const norm = (p: string) =>
      p
        .split("/")
        .filter(Boolean)
        .map((s) => s.replace(/[()]/g, ""));

    const segsFromHook = Array.isArray(segments) ? (segments as string[]) : [];
    const segsNormalized = segsFromHook.map((s) => s.replace(/[()]/g, ""));
    const afterTabsIdx = segsNormalized.indexOf("tabs");
    const afterTabsRaw =
      afterTabsIdx >= 0
        ? segsNormalized.slice(afterTabsIdx + 1)
        : segsNormalized;

    const pathFallbackSegs = norm(pathname || "");
    const fallbackLast = pathFallbackSegs[pathFallbackSegs.length - 1];
    const pathLooksLikeId = /[0-9a-fA-F]{8,}/.test(fallbackLast || "");
    const actualId = pathLooksLikeId ? fallbackLast : undefined;

    const librariesIdx = afterTabsRaw.indexOf("libraries");
    const isLibrariesRoot =
      librariesIdx >= 0 && afterTabsRaw.length === librariesIdx + 1;
    const hasLibraries = librariesIdx >= 0;
    const hasCollections = afterTabsRaw.includes("collections");

    const baseCandidates = ["home", "search", "favorites", "settings"] as const;
    const baseKey =
      baseCandidates.find((k) => afterTabsRaw.includes(k)) ??
      (baseCandidates.includes(pathFallbackSegs[0] as any)
        ? (pathFallbackSegs[0] as any)
        : undefined);

    return {
      afterTabsRaw,
      actualId,
      isLibrariesRoot,
      hasLibraries,
      hasCollections,
      baseKey,
    };
  }, [pathname, segments]);

  const idToKey = useMemo(() => {
    const lib = new Map<string, string>();
    const col = new Map<string, string>();
    for (const it of menuItems) {
      if (it.routeType === "library" && it.underlyingId)
        lib.set(it.underlyingId, it.key);
      if (it.routeType === "collection" && it.underlyingId)
        col.set(it.underlyingId, it.key);
    }
    return { lib, col };
  }, [menuItems]);

  const activeKey = useMemo(() => {
    if (pathMeta.baseKey) return pathMeta.baseKey;
    if (pathMeta.isLibrariesRoot) return "libraries";
    if (pathMeta.actualId) {
      if (pathMeta.hasCollections)
        return idToKey.col.get(pathMeta.actualId) || null;
      if (pathMeta.hasLibraries)
        return idToKey.lib.get(pathMeta.actualId) || null;
    }
    return null;
  }, [pathMeta, idToKey]);

  const handleSidebarFocus = useCallback(
    (itemKey?: string) => {
      // Ignore transient focus events during/just-after navigation
      if (Date.now() < suppressFocusToggleUntilRef.current) return;
      // Cancel any pending blur collapse
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }

      // Expand the sidebar when a sidebar item receives focus
      if (!isStickyOpen || !isSidebarFocused) {
        try {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        } catch {}
        setIsStickyOpen((prev) => (prev ? prev : true));
        setIsSidebarFocused((prev) => (prev ? prev : true));
      }

      // We've re-entered the sidebar, so clear any pending restore hint
      setRestoreFocusOnNextEnter((prev) => (prev ? false : prev));
      devLog("onFocus sidebar item", { itemKey, pathname });
    },
    [devLog, isSidebarFocused, isStickyOpen, pathname],
  );

  const handleSidebarBlur = useCallback(
    (itemKey?: string) => {
      // Small delay to allow navigation between sidebar items
      // stor the last used itemKey for focus restoration on re-entry
      itemKey && setLastFocusedKey(itemKey);
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }

      blurTimeoutRef.current = setTimeout(() => {
        if (isSidebarFocused || isStickyOpen) {
          try {
            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut,
            );
          } catch {}
          // Collapse only if no other sidebar item regained focus within the debounce window
          setIsSidebarFocused((prev) => (prev ? false : prev));
          setIsStickyOpen((prev) => (prev ? false : prev));
          // Hint that on next re-entry we should restore focus to the last item
          setRestoreFocusOnNextEnter((prev) => (prev ? prev : true));
        }
        blurTimeoutRef.current = null;
      }, 250); // Slightly longer delay for smoother, less jittery collapse
      devLog("onBlur sidebar", { itemKey, pathname });
    },
    [devLog, isSidebarFocused, isStickyOpen, pathname],
  );

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

  // Memoized row component (defined before any conditional returns to respect Hooks rules)
  const SidebarItem = useMemo(() => {
    return memo(function SidebarItem({
      item,
      isActive,
      isExpanded,
      preferred,
      elementKey,
      onPressItem,
      onFocusItem,
      onBlurItem,
    }: {
      item: MenuItem;
      isActive: boolean;
      isExpanded: boolean;
      preferred: boolean;
      elementKey: string;
      onPressItem: (it: MenuItem) => void;
      onFocusItem: (key: string) => void;
      onBlurItem: (key: string) => void;
    }) {
      return (
        <TouchableOpacity
          key={elementKey}
          className={`flex-row items-center ${
            isExpanded ? "justify-start px-3" : "justify-center px-0"
          } rounded-lg relative bg-transparent min-h-[52px] w-full ${
            isActive ? "bg-purple-600/15" : ""
          }`}
          onPress={() => onPressItem(item)}
          onFocus={() => onFocusItem(item.key)}
          onBlur={() => onBlurItem(item.key)}
          {...(Platform.isTV
            ? ({ hasTVPreferredFocus: preferred, focusable: true } as any)
            : undefined)}
          accessibilityLabel={item.titleKey ? t(item.titleKey) : item.title}
          accessibilityRole='button'
        >
          <View
            style={
              isExpanded
                ? { width: 36, alignItems: "center", marginRight: 12 }
                : { flex: 1, alignItems: "center" }
            }
          >
            {item.imageIconUri ? (
              <Image
                source={{ uri: item.imageIconUri }}
                style={{ width: 28, height: 28, borderRadius: 6 }}
                resizeMode='cover'
              />
            ) : (
              <MaterialIcons
                name={(item.icon as any) || "link"}
                size={28}
                color={isActive ? "#9334E9" : "#fff"}
              />
            )}
          </View>
          {isExpanded && (
            <Text
              className={`text-base font-medium text-white flex-1 ${
                isActive ? "text-purple-600 font-semibold" : ""
              }`}
              numberOfLines={1}
              ellipsizeMode='tail'
            >
              {item.titleKey ? t(item.titleKey) : item.title}
            </Text>
          )}
          {isActive && (
            <View className='absolute left-0 top-0 bottom-0 w-1 bg-purple-600 rounded-sm' />
          )}
        </TouchableOpacity>
      );
    });
  }, [t]);

  const onPressItem = useCallback(
    (item: MenuItem) => {
      setLastFocusedKey(item.key);
      setPreferredFocusKey(item.key);
      setFocusRemountToken((c) => c + 1);
      if (item.route) {
        handleSidebarPress(item.route);
      } else {
        devLog("onPress dynamic tvSidebarLinks item (no route yet)", item);
      }
    },
    [devLog, handleSidebarPress],
  );

  const onFocusItem = useCallback(
    (key: string) => handleSidebarFocus(key),
    [handleSidebarFocus],
  );
  const onBlurItem = useCallback(
    (key: string) => handleSidebarBlur(key),
    [handleSidebarBlur],
  );

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
          isExpanded ? "w-40" : "w-14"
        }`}
      >
        <View className='flex-1 pt-0'>
          {/* Header - keep title mounted but hide when collapsed */}
          <View
            className={`flex-row items-center border-b-2 border-neutral-700 mb-4 h-16 ${
              isExpanded ? "justify-start px-3" : "justify-center px-0"
            }`}
          >
            <View
              style={
                isExpanded
                  ? { width: 36, alignItems: "flex-start" }
                  : { flex: 1, alignItems: "center" }
              }
            >
              <Image
                source={require("@/assets/images/icon-android-plain.png")}
                style={{ width: 36, height: 36, borderRadius: 6 }}
                accessibilityLabel='Streamyfin icon'
                resizeMode='contain'
              />
            </View>
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
              data={[...menuItems, ...baseAfter]}
              keyExtractor={(it) => it.key}
              renderItem={({ item }) => {
                const isActive = item.key === activeKey;
                const elementKey =
                  preferredFocusKey === item.key && focusRemountToken
                    ? `${item.key}-pf-${focusRemountToken}`
                    : item.key;
                // Fallback: if item is missing imageIconUri but API is ready, compute on the fly
                if (!item.imageIconUri && item.underlyingId && api) {
                  try {
                    const u = getPrimaryImageUrlById({
                      api,
                      id: item.underlyingId,
                      width: 64,
                      quality: 90,
                    });
                    if (u && !String(u).startsWith("undefined")) {
                      // mutate a shallow copy to avoid breaking memoization identity of menuItems array
                      (item as any).imageIconUri = u;
                    }
                  } catch {}
                }

                return (
                  <SidebarItem
                    item={item}
                    isActive={!!isActive}
                    isExpanded={isExpanded}
                    preferred={
                      preferredFocusKey != null &&
                      preferredFocusKey === item.key
                    }
                    elementKey={elementKey}
                    onPressItem={onPressItem}
                    onFocusItem={onFocusItem}
                    onBlurItem={onBlurItem}
                  />
                );
              }}
              extraData={{
                isExpanded,
                activeKey,
                preferredFocusKey,
                focusRemountToken,
              }}
              initialNumToRender={10}
              windowSize={10}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={32}
              removeClippedSubviews={false}
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
