import { useActionSheet } from "@expo/react-native-action-sheet";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { useRouter, useSegments } from "expo-router";
import { useCallback } from "react";
import { Platform } from "react-native";
import { useFavorite } from "@/hooks/useFavorite";
import { useMarkAsPlayed } from "@/hooks/useMarkAsPlayed";
import { FocusableEpisode } from "../common/FocusableEpisode";
import { itemRouter, TouchableItemRouter } from "../common/TouchableItemRouter";

interface Props {
  item: BaseItemDto;
  children: React.ReactNode;
  className?: string;
  isOffline?: boolean;
}

/**
 * Episode item wrapper that uses background highlighting on TV instead of elevation
 */
export const EpisodeItem: React.FC<Props> = ({
  item,
  children,
  className,
  isOffline = false,
}) => {
  const router = useRouter();
  const segments = useSegments();
  const { showActionSheetWithOptions } = useActionSheet();
  const markAsPlayedStatus = useMarkAsPlayed([item]);
  const { isFavorite, toggleFavorite } = useFavorite(item);

  const from = segments[2];

  const showActionSheet = useCallback(() => {
    if (
      !(
        item.Type === "Movie" ||
        item.Type === "Episode" ||
        item.Type === "Series"
      )
    )
      return;
    const options = [
      "Mark as Played",
      "Mark as Not Played",
      isFavorite ? "Unmark as Favorite" : "Mark as Favorite",
      "Cancel",
    ];
    const cancelButtonIndex = 3;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
      },
      async (selectedIndex) => {
        if (selectedIndex === 0) {
          await markAsPlayedStatus(true);
        } else if (selectedIndex === 1) {
          await markAsPlayedStatus(false);
        } else if (selectedIndex === 2) {
          toggleFavorite();
        }
      },
    );
  }, [showActionSheetWithOptions, isFavorite, markAsPlayedStatus]);

  const handlePress = useCallback(() => {
    if (!from) return;
    let url = itemRouter(item, from);
    if (isOffline) {
      url += `&offline=true`;
    }
    // @ts-expect-error
    router.push(url);
  }, [item, from, isOffline, router]);

  // On TV, use our custom episode component with background highlighting
  if (Platform.isTV) {
    return (
      <FocusableEpisode
        onPress={handlePress}
        onLongPress={showActionSheet}
        className={className}
      >
        {children}
      </FocusableEpisode>
    );
  }

  // On other platforms, use the regular TouchableItemRouter
  return (
    <TouchableItemRouter
      item={item}
      isOffline={isOffline}
      className={className}
    >
      {children}
    </TouchableItemRouter>
  );
};
