import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { FlashList } from "@shopify/flash-list";
import {
  type QueryFunction,
  type QueryKey,
  useQuery,
} from "@tanstack/react-query";
import React, { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, View, type ViewProps } from "react-native";
import { Text } from "@/components/common/Text";
import MoviePoster from "@/components/posters/MoviePoster";
import ContinueWatchingPoster from "../ContinueWatchingPoster";
import { TouchableItemRouter } from "../common/TouchableItemRouter";
import { ItemCardText } from "../ItemCardText";
import SeriesPoster from "../posters/SeriesPoster";

interface Props extends ViewProps {
  title?: string | null;
  orientation?: "horizontal" | "vertical";
  disabled?: boolean;
  queryKey: QueryKey;
  queryFn: QueryFunction<BaseItemDto[]>;
  hideIfEmpty?: boolean;
  isOffline?: boolean;
}

const ScrollingCollectionListComponent: React.FC<Props> = ({
  title,
  orientation = "vertical",
  disabled = false,
  queryFn,
  queryKey,
  hideIfEmpty = false,
  isOffline = false,
  ...props
}) => {
  const { data, isLoading } = useQuery({
    queryKey: queryKey,
    queryFn,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { t } = useTranslation();

  const items = data ?? [];
  const estimatedItemSize = useMemo(() => {
    // Rough width including margins for TV virtualization
    return orientation === "horizontal" ? 200 : 140;
  }, [orientation]);

  const keyExtractor = useCallback(
    (item: BaseItemDto) => item.Id ?? String(item.Name),
    [],
  );

  const renderPoster = useCallback(
    (item: BaseItemDto) => {
      // Match original render logic by item type and orientation
      if (item.Type === "Episode") {
        return orientation === "horizontal" ? (
          <ContinueWatchingPoster item={item} />
        ) : (
          <SeriesPoster item={item} />
        );
      }
      if (item.Type === "Movie") {
        return orientation === "horizontal" ? (
          <ContinueWatchingPoster item={item} />
        ) : (
          <MoviePoster item={item} />
        );
      }
      if (item.Type === "Series") {
        return orientation === "horizontal" ? (
          <ContinueWatchingPoster item={item} />
        ) : (
          <SeriesPoster item={item} />
        );
      }
      return <ContinueWatchingPoster item={item} />;
    },
    [orientation],
  );

  const renderItem = useCallback(
    ({ item }: { item: BaseItemDto }) => (
      <TouchableItemRouter
        item={item}
        key={item.Id}
        isOffline={isOffline}
        className={`
          ${Platform.isTV ? "mx-3" : "mr-2"}
          ${orientation === "horizontal" ? "w-44" : "w-28"}
        `}
      >
        {renderPoster(item)}
        <ItemCardText item={item} />
      </TouchableItemRouter>
    ),
    [isOffline, orientation, renderPoster],
  );

  if (hideIfEmpty === true && data?.length === 0) return null;
  if (disabled || !title) return null;

  return (
    <View {...props}>
      <Text className='px-4 text-lg font-bold mb-2 text-neutral-100'>
        {title}
      </Text>
      {isLoading === false && data?.length === 0 && (
        <View className='px-4'>
          <Text className='text-neutral-500'>{t("home.no_items")}</Text>
        </View>
      )}
      {isLoading ? (
        <View
          className={`
            flex flex-row gap-2 px-4
        `}
        >
          {[1, 2, 3].map((i) => (
            <View className='w-44' key={i}>
              <View className='bg-neutral-900 h-24 w-full rounded-md mb-1' />
              <View className='rounded-md overflow-hidden mb-1 self-start'>
                <Text
                  className='text-neutral-900 bg-neutral-900 rounded-md'
                  numberOfLines={1}
                >
                  Nisi mollit voluptate amet.
                </Text>
              </View>
              <View className='rounded-md overflow-hidden self-start mb-1'>
                <Text
                  className='text-neutral-900 bg-neutral-900 text-xs rounded-md '
                  numberOfLines={1}
                >
                  Lorem ipsum
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : Platform.isTV ? (
        <FlashList
          horizontal
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsHorizontalScrollIndicator={false}
          estimatedItemSize={estimatedItemSize}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 16,
          }}
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={Platform.isTV ? { overflow: "visible" } : undefined}
        >
          <View
            className={`flex flex-row ${Platform.isTV ? "px-4 py-4" : "px-4"}`}
            style={Platform.isTV ? { overflow: "visible" } : undefined}
          >
            {items.map((item) => renderItem({ item }))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

// Shallow compare props to avoid unnecessary re-renders when inputs are stable
const areEqual = (prev: Props, next: Props) => {
  const shallowArrayEqual = (a?: any[], b?: any[]) => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };
  return (
    prev.title === next.title &&
    prev.orientation === next.orientation &&
    prev.disabled === next.disabled &&
    shallowArrayEqual(prev.queryKey as any, next.queryKey as any) &&
    prev.queryFn === next.queryFn &&
    prev.hideIfEmpty === next.hideIfEmpty &&
    prev.isOffline === next.isOffline
  );
};

export const ScrollingCollectionList = memo(
  ScrollingCollectionListComponent,
  areEqual,
);
