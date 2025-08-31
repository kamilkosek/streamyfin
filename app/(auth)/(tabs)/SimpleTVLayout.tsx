import { MaterialIcons } from "@expo/vector-icons";
import { Slot, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Colors } from "@/constants/Colors";

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
  const [isSidebarFocused, setIsSidebarFocused] = useState(false);
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
      return pathname.includes(route.split("/").pop() || "");
    },
    [pathname],
  );

  const handleSidebarFocus = useCallback(() => {
    // cancel any pending blur collapse and expand immediately
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    // animate if available
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch {}
    setIsSidebarFocused(true);
  }, []);

  const handleSidebarBlurWithDelay = useCallback(() => {
    // small delay so quick focus moves within the sidebar don't collapse it
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => {
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch {}
      setIsSidebarFocused(false);
      blurTimeoutRef.current = null;
    }, 140);
  }, []);

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

  // Only show this layout on TV platforms
  if (!Platform.isTV) {
    return (
      <View style={styles.container}>
        <Slot />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Focus-Responsive Sidebar - single mounted tree to avoid remount/focus jumps */}
      <View
        style={[styles.sidebar, !isSidebarFocused && styles.sidebarCollapsed]}
      >
        <View style={styles.sidebarContent}>
          {/* Header - keep title mounted but hide when collapsed */}
          <View
            style={[
              styles.sidebarHeader,
              !isSidebarFocused && styles.collapsedHeader,
            ]}
          >
            <MaterialIcons name='tv' size={24} color={Colors.primary} />
            <Text
              style={[styles.appName, !isSidebarFocused && styles.hiddenText]}
            >
              Streamyfin
            </Text>
          </View>

          {/* Menu Items - keep Touchables mounted in both states */}
          <View
            style={[
              styles.sidebarMenuContainer,
              !isSidebarFocused && styles.collapsedMenuContainer,
            ]}
          >
            {menuItems.map((item, index) => {
              const isActive = isRouteActive(item.route);

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.sidebarMenuItem,
                    isActive && styles.sidebarMenuItemActive,
                    !isSidebarFocused && styles.collapsedMenuItemOverride,
                  ]}
                  onPress={() => navigateToRoute(item.route)}
                  onFocus={handleSidebarFocus}
                  onBlur={handleSidebarBlurWithDelay}
                  accessibilityLabel={t(item.titleKey)}
                  accessibilityRole='button'
                  hasTVPreferredFocus={index === 0 && pathname === "/"}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={24}
                    color={isActive ? Colors.primary : "#fff"}
                    style={[
                      styles.sidebarMenuIcon,
                      !isSidebarFocused && styles.iconCollapsed,
                    ]}
                  />

                  <Text
                    style={[
                      styles.sidebarMenuText,
                      isActive && styles.sidebarMenuTextActive,
                      !isSidebarFocused && styles.hiddenText,
                    ]}
                  >
                    {t(item.titleKey)}
                  </Text>

                  {isActive && <View style={styles.sidebarActiveIndicator} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* collapsed navigation hint - still mounted but hidden when expanded/collapsed via styles */}
          <View style={styles.collapsedNavigationHint} pointerEvents='none'>
            <MaterialIcons name='keyboard-arrow-right' size={16} color='#666' />
          </View>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const SIDEBAR_WIDTH = 200;
const COLLAPSED_SIDEBAR_WIDTH = 60;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#000",
  },
  content: {
    flex: 1,
    backgroundColor: "#000",
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: "#1a1a1a",
    borderRightWidth: 1,
    borderRightColor: "#333",
    shadowColor: "#000",
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 16,
  },
  sidebarCollapsed: {
    width: COLLAPSED_SIDEBAR_WIDTH,
    backgroundColor: "#1a1a1a",
  },
  sidebarContent: {
    flex: 1,
    paddingTop: 0,
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 0,
    borderBottomWidth: 2,
    borderBottomColor: "#333",
    marginBottom: 16,
    marginHorizontal: 0,
    height: 72,
    justifyContent: "flex-start",
  },
  appName: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.primary,
    marginLeft: 12,
  },
  sidebarMenuContainer: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  sidebarMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 0,
    paddingHorizontal: 12,
    marginBottom: 2,
    borderRadius: 8,
    position: "relative",
    backgroundColor: "transparent",
    minHeight: 52,
  },
  sidebarMenuItemActive: {
    backgroundColor: "rgba(138, 180, 248, 0.15)",
  },
  sidebarMenuIcon: {
    marginRight: 12,
  },
  sidebarMenuText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
    flex: 1,
  },
  sidebarMenuTextActive: {
    color: Colors.primary,
    fontWeight: "600",
  },
  sidebarActiveIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  sidebarFooter: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#333",
    alignItems: "center",
  },
  sidebarFooterText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  // Collapsed styles
  collapsedContent: {
    flex: 1,
    paddingTop: 0,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  collapsedHeader: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderBottomWidth: 2,
    borderBottomColor: "#333",
    marginBottom: 16,
    marginHorizontal: 0,
    width: "100%",
    height: 72,
  },
  collapsedMenuContainer: {
    flex: 1,
    width: "100%",
    // alignItems: "center",
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  collapsedMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: 44,
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginBottom: 4,
    borderRadius: 8,
    backgroundColor: "transparent",
    minHeight: 52,
  },
  collapsedMenuItemActive: {
    backgroundColor: "rgba(138, 180, 248, 0.15)",
  },
  // Overrides used when sidebar is collapsed but items remain mounted
  collapsedMenuItemOverride: {
    marginBottom: 2,
    minHeight: 52,
    width: "100%",
    justifyContent: "flex-start",
    paddingHorizontal: 12,
  },
  // visually hide text but keep it mounted for accessibility and layout stability
  hiddenText: {
    opacity: 0,
    width: 0,
    height: 0,
  },
  // keep icon aligned when collapsed
  iconCollapsed: {
    marginRight: 12,
  },
  collapsedActiveIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  collapsedNavigationHint: {
    marginTop: "auto",
    paddingTop: 16,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.6,
  },
});
