import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Image } from "expo-image";
import { useEffect, useMemo } from "react";
import { Platform, ScrollView, TouchableOpacity, View } from "react-native";

const DropdownMenu = !Platform.isTV ? require("zeego/dropdown-menu") : null;

import { t } from "i18next";
import { useAtom } from "jotai";
import { apiAtom } from "@/providers/JellyfinProvider";
import { getPrimaryImageUrl } from "@/utils/jellyfin/image/getPrimaryImageUrl";
import { Text } from "../common/Text";
import { TVFocusableItem } from "../common/TVFocusableItem";

type Props = {
  item: BaseItemDto;
  seasons: BaseItemDto[];
  initialSeasonIndex?: number;
  state: SeasonIndexState;
  onSelect: (season: BaseItemDto) => void;
};

type SeasonKeys = {
  id: keyof BaseItemDto;
  title: keyof BaseItemDto;
  index: keyof BaseItemDto;
};

export type SeasonIndexState = {
  [seriesId: string]: number | string | null | undefined;
};

export const SeasonDropdown: React.FC<Props> = ({
  item,
  seasons,
  initialSeasonIndex,
  state,
  onSelect,
}) => {
  const isTv = Platform.isTV;
  const [api] = useAtom(apiAtom);

  const keys = useMemo<SeasonKeys>(
    () =>
      item.Type === "Episode"
        ? {
            id: "ParentId",
            title: "SeasonName",
            index: "ParentIndexNumber",
          }
        : {
            id: "Id",
            title: "Name",
            index: "IndexNumber",
          },
    [item],
  );

  const seasonIndex = useMemo(
    () => state[(item[keys.id] as string) ?? ""],
    [state, item, keys],
  );

  useEffect(() => {
    if (seasons && seasons.length > 0 && seasonIndex === undefined) {
      let initialIndex: number | undefined;

      if (initialSeasonIndex !== undefined) {
        // Use the provided initialSeasonIndex if it exists in the seasons
        const seasonExists = seasons.some(
          (season: any) => season[keys.index] === initialSeasonIndex,
        );
        if (seasonExists) {
          initialIndex = initialSeasonIndex;
        }
      }

      if (initialIndex === undefined) {
        // Fall back to the previous logic if initialIndex is not set
        const season1 = seasons.find((season: any) => season[keys.index] === 1);
        const season0 = seasons.find((season: any) => season[keys.index] === 0);
        const firstSeason = season1 || season0 || seasons[0];
        onSelect(firstSeason);
      }

      if (initialIndex !== undefined) {
        const initialSeason = seasons.find(
          (season: any) => season[keys.index] === initialIndex,
        );
        if (initialSeason) onSelect(initialSeason!);
        else throw Error("Initial index could not be found!");
      }
    }
  }, [seasons, seasonIndex, item, item[keys.id], initialSeasonIndex, keys]);

  const sortByIndex = (a: BaseItemDto, b: BaseItemDto) =>
    Number(a[keys.index]) - Number(b[keys.index]);

  // TV Season Picker - Horizontal scroll with season posters
  if (isTv) {
    if (!seasons || seasons.length <= 1) return null;

    return (
      <View className='mb-4' style={{ marginLeft: Platform.isTV ? 8 : 0 }}>
        <Text className='text-lg font-semibold px-4 mb-3 text-white'>
          {t("item_card.seasons")}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: Platform.isTV ? 24 : 16, // Extra padding on TV to avoid sidebar overlap
            paddingVertical: 8,
          }}
          className='flex-row'
        >
          {seasons?.sort(sortByIndex).map((season: any, index: number) => {
            const title =
              season[keys.title] ||
              season.Name ||
              `Season ${season.IndexNumber}`;
            const isSelected =
              season[keys.index] === seasonIndex || season.Name === seasonIndex;
            const imageUrl = getPrimaryImageUrl({
              api,
              item: season,
              quality: 90,
              width: 300,
            });

            return (
              <TVFocusableItem
                key={season.Id || season.IndexNumber || index}
                onPress={() => onSelect(season)}
                className={`mr-4 ${isSelected ? "opacity-100" : "opacity-70"}`}
                style={{
                  width: 120,
                  // Ensure proper overflow handling for elevation
                  overflow: "visible",
                }}
              >
                <View
                  className={`rounded-lg overflow-hidden border-2 ${
                    isSelected ? "border-purple-500" : "border-neutral-700"
                  }`}
                >
                  <Image
                    source={imageUrl ? { uri: imageUrl } : null}
                    style={{
                      width: 120,
                      height: 180,
                      backgroundColor: "#1f2937",
                    }}
                    contentFit='cover'
                    placeholder={
                      season.ImageBlurHashes?.Primary &&
                      Object.values(season.ImageBlurHashes.Primary)[0]
                        ? {
                            blurhash: Object.values(
                              season.ImageBlurHashes.Primary,
                            )[0] as string,
                          }
                        : null
                    }
                  />
                  {!imageUrl && (
                    <View className='absolute inset-0 bg-neutral-800 flex items-center justify-center'>
                      <Text className='text-neutral-400 text-xs text-center px-2'>
                        {title}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  className={`text-center mt-2 text-sm ${
                    isSelected ? "text-white font-semibold" : "text-neutral-400"
                  }`}
                  numberOfLines={2}
                >
                  {title}
                </Text>
              </TVFocusableItem>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // Mobile/Desktop dropdown (existing implementation)
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <View className='flex flex-row'>
          <TouchableOpacity className='bg-neutral-900 rounded-2xl border-neutral-900 border px-3 py-2 flex flex-row items-center justify-between'>
            <Text>
              {t("item_card.season")} {seasonIndex}
            </Text>
          </TouchableOpacity>
        </View>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        loop={true}
        side='bottom'
        align='start'
        alignOffset={0}
        avoidCollisions={true}
        collisionPadding={8}
        sideOffset={8}
      >
        <DropdownMenu.Label>{t("item_card.seasons")}</DropdownMenu.Label>
        {seasons?.sort(sortByIndex).map((season: any) => {
          const title =
            season[keys.title] || season.Name || `Season ${season.IndexNumber}`;
          return (
            <DropdownMenu.Item
              key={season.Id || season.IndexNumber}
              onSelect={() => onSelect(season)}
            >
              <DropdownMenu.ItemTitle>{title}</DropdownMenu.ItemTitle>
            </DropdownMenu.Item>
          );
        })}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};
