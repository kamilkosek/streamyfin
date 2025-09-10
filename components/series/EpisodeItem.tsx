import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { useRouter, useSegments } from "expo-router";
import { t } from "i18next";
import { useCallback } from "react";
import { Platform } from "react-native";
import { useFavorite } from "@/hooks/useFavorite";
import { useMarkAsPlayed } from "@/hooks/useMarkAsPlayed";
import { useActionSheet } from "../actionsheet";
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
  const { showActionSheet } = useActionSheet();
  const markAsPlayedStatus = useMarkAsPlayed([item]);
  const { isFavorite, toggleFavorite } = useFavorite(item);

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
      title: t("action_sheet.media_options.media_options"),
      message: t("action_sheet.media_options.description"),
      options: [
        {
          title: t("action_sheet.media_options.mark_as_played"),
          onPress: async () => {
            await markAsPlayedStatus(true);
          },
        },
        {
          title: t("action_sheet.media_options.mark_as_unplayed"),
          onPress: async () => {
            await markAsPlayedStatus(false);
          },
        },
        {
          title: isFavorite
            ? t("action_sheet.media_options.remove_from_favorites")
            : t("action_sheet.media_options.add_to_favorites"),
          onPress: () => {
            toggleFavorite();
          },
        },
      ],
    });
  }, [showActionSheet, isFavorite, markAsPlayedStatus, toggleFavorite]);

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
        onLongPress={showActionSheetMenu}
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
