import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAtom } from "jotai";
import { useEffect, useMemo, useRef } from "react";
import { type ViewProps } from "react-native";
import { useDownload } from "@/providers/DownloadProvider";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import { getUserItemData } from "@/utils/jellyfin/user-library/getUserItemData";
import ContinueWatchingPoster from "../ContinueWatchingPoster";
import { FocusableItem } from "../common/FocusableItem";
import {
  HorizontalScroll,
  type HorizontalScrollRef,
} from "../common/HorizontalScroll";
import { ItemCardText } from "../ItemCardText";

// Episode item component with TV elevation effect
interface EpisodeCarouselItemProps {
  item: BaseItemDto;
  isActive: boolean;
  onPress: () => void;
}

const EpisodeCarouselItem: React.FC<EpisodeCarouselItemProps> = ({
  item,
  isActive,
  onPress,
}) => {
  return (
    <FocusableItem
      onPress={onPress}
      className={`flex flex-col w-44 ${!isActive ? "opacity-50" : ""}`}
    >
      <ContinueWatchingPoster item={item} useEpisodePoster />
      <ItemCardText item={item} />
    </FocusableItem>
  );
};

interface Props extends ViewProps {
  item?: BaseItemDto | null;
  loading?: boolean;
  isOffline?: boolean;
}

export const SeasonEpisodesCarousel: React.FC<Props> = ({
  item,
  loading,
  isOffline,
  ...props
}) => {
  const [api] = useAtom(apiAtom);
  const [user] = useAtom(userAtom);
  const { getDownloadedItems } = useDownload();
  const downloadedFiles = getDownloadedItems();

  const scrollRef = useRef<HorizontalScrollRef>(null);

  const scrollToIndex = (index: number) => {
    scrollRef.current?.scrollToIndex(index, 16);
  };

  const seasonId = useMemo(() => {
    return item?.SeasonId;
  }, [item]);

  const { data: episodes, isPending } = useQuery({
    queryKey: ["episodes", seasonId, isOffline],
    queryFn: async () => {
      if (isOffline) {
        return downloadedFiles
          ?.filter(
            (f) => f.item.Type === "Episode" && f.item.SeasonId === seasonId,
          )
          .map((f) => f.item);
      }
      if (!api || !user?.Id || !item?.SeriesId) return [];
      const response = await getTvShowsApi(api).getEpisodes({
        userId: user.Id,
        seasonId: seasonId || undefined,
        seriesId: item.SeriesId,
        fields: [
          "ItemCounts",
          "PrimaryImageAspectRatio",
          "CanDelete",
          "MediaSourceCount",
          "Overview",
        ],
      });
      return response.data.Items as BaseItemDto[];
    },
    enabled: !!api && !!user?.Id && !!seasonId,
  });

  /**
   * Prefetch previous and next episode
   */
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!item?.Id || !item.IndexNumber || !episodes || episodes.length === 0) {
      return;
    }

    const previousId = episodes?.find(
      (ep) => ep.IndexNumber === item.IndexNumber! - 1,
    )?.Id;
    if (previousId) {
      queryClient.prefetchQuery({
        queryKey: ["item", previousId],
        queryFn: async () =>
          await getUserItemData({
            api,
            userId: user?.Id,
            itemId: previousId,
          }),
        staleTime: 60 * 1000 * 5,
      });
    }

    const nextId = episodes?.find(
      (ep) => ep.IndexNumber === item.IndexNumber! + 1,
    )?.Id;
    if (nextId) {
      queryClient.prefetchQuery({
        queryKey: ["item", nextId],
        queryFn: async () =>
          await getUserItemData({
            api,
            userId: user?.Id,
            itemId: nextId,
          }),
        staleTime: 60 * 1000 * 5,
      });
    }
  }, [episodes, api, user?.Id, item]);

  useEffect(() => {
    if (item?.Type === "Episode" && item.Id) {
      const index = episodes?.findIndex((ep) => ep.Id === item.Id);
      if (index !== undefined && index !== -1) {
        setTimeout(() => {
          scrollToIndex(index);
        }, 400);
      }
    }
  }, [episodes, item]);

  return (
    <HorizontalScroll
      ref={scrollRef}
      data={episodes}
      extraData={item}
      loading={loading || isPending}
      renderItem={(_item, _idx) => (
        <EpisodeCarouselItem
          key={_item.Id}
          item={_item}
          isActive={item?.Id === _item.Id}
          onPress={() => router.setParams({ id: _item.Id })}
        />
      )}
      {...props}
    />
  );
};
