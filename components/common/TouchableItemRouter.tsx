import Ionicons from "@expo/vector-icons/Ionicons";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { useRouter, useSegments } from "expo-router";
import { type PropsWithChildren, useCallback } from "react";
import {
  Platform,
  Pressable,
  TouchableOpacity,
  type TouchableOpacityProps,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useFavorite } from "@/hooks/useFavorite";
import { useFocusAnimation } from "@/hooks/useFocusAnimation";
import { useMarkAsPlayed } from "@/hooks/useMarkAsPlayed";
import { useActionSheet } from "../actionsheet";

interface Props extends TouchableOpacityProps {
  item: BaseItemDto;
  isOffline?: boolean;
}

export const itemRouter = (item: BaseItemDto, from: string) => {
  if ("CollectionType" in item && item.CollectionType === "livetv") {
    return `/(auth)/(tabs)/${from}/livetv`;
  }

  if (item.Type === "Series") {
    return `/(auth)/(tabs)/${from}/series/${item.Id}`;
  }

  if (item.Type === "Person") {
    return `/(auth)/(tabs)/${from}/persons/${item.Id}`;
  }

  if (item.Type === "BoxSet") {
    return `/(auth)/(tabs)/${from}/collections/${item.Id}`;
  }

  if (item.Type === "UserView") {
    return `/(auth)/(tabs)/${from}/collections/${item.Id}`;
  }

  if (item.Type === "CollectionFolder") {
    return `/(auth)/(tabs)/(libraries)/${item.Id}`;
  }

  if (item.Type === "Playlist") {
    return `/(auth)/(tabs)/(libraries)/${item.Id}`;
  }

  return `/(auth)/(tabs)/${from}/items/page?id=${item.Id}`;
};

export const TouchableItemRouter: React.FC<PropsWithChildren<Props>> = ({
  item,
  isOffline = false,
  children,
  style,
  ...props
}) => {
  const router = useRouter();
  const segments = useSegments();
  const { showActionSheet } = useActionSheet();
  const markAsPlayedStatus = useMarkAsPlayed([item]);
  const { isFavorite, toggleFavorite } = useFavorite(item);

  // TV animation values
  const { animatedStyle, shadowStyle, handleFocus, handleBlur } =
    useFocusAnimation();

  const from = segments[2];

  const showActionSheetMenu = useCallback(() => {
    if (
      !(
        item.Type === "Movie" ||
        item.Type === "Episode" ||
        item.Type === "Series"
      )
    )
      return;

    showActionSheet({
      title: "Media Options",
      message: "Choose an action for this item",
      options: [
        {
          title: "Mark as Played",
          onPress: async () => {
            await markAsPlayedStatus(true);
          },
          icon: (
            <Ionicons name='checkmark-circle-outline' size={20} color='white' />
          ),
        },
        {
          title: "Mark as Not Played",
          onPress: async () => {
            await markAsPlayedStatus(false);
          },
          icon: (
            <Ionicons name='remove-circle-outline' size={20} color='white' />
          ),
        },
        {
          title: isFavorite ? "Unmark as Favorite" : "Mark as Favorite",
          onPress: () => {
            toggleFavorite();
          },
          icon: (
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={20}
              color={isFavorite ? "#ff453a" : "white"}
            />
          ),
        },
      ],
    });
  }, [item, showActionSheet, markAsPlayedStatus, isFavorite, toggleFavorite]);

  const handlePress = useCallback(() => {
    if (!from) return;
    let url = itemRouter(item, from);
    if (isOffline) {
      url += `&offline=true`;
    }
    // @ts-expect-error
    router.push(url);
  }, [item, from, isOffline, router]);

  // TV Platform - use Pressable with elevation animation
  if (Platform.isTV) {
    return (
      <View style={{ overflow: "visible" }}>
        <Pressable
          onPress={handlePress}
          onLongPress={showActionSheetMenu}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[style, { overflow: "visible" }]}
          {...props}
        >
          <Animated.View style={[animatedStyle, shadowStyle]}>
            {children}
          </Animated.View>
        </Pressable>
      </View>
    );
  }

  // Non-TV platforms - use regular TouchableOpacity
  return (
    <TouchableOpacity
      onLongPress={showActionSheetMenu}
      onPress={handlePress}
      style={style}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
};
