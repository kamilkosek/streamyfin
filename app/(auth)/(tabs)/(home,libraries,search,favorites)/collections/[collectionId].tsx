import type {
  BaseItemDto,
  BaseItemDtoQueryResult,
  ItemSortBy,
} from "@jellyfin/sdk/lib/generated-client/models";
import {
  getFilterApi,
  getItemsApi,
  getUserLibraryApi,
} from "@jellyfin/sdk/lib/utils/api";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useAtom } from "jotai";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Platform, View } from "react-native";
import { Text } from "@/components/common/Text";
import { TouchableItemRouter } from "@/components/common/TouchableItemRouter";
import { FilterButton } from "@/components/filters/FilterButton";
import { ResetFiltersButton } from "@/components/filters/ResetFiltersButton";
import { ItemCardText } from "@/components/ItemCardText";
import { ItemPoster } from "@/components/posters/ItemPoster";
import * as ScreenOrientation from "@/packages/expo-screen-orientation";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import {
  genreFilterAtom,
  SortByOption,
  SortOrderOption,
  sortByAtom,
  sortOptions,
  sortOrderAtom,
  sortOrderOptions,
  tagsFilterAtom,
  yearFilterAtom,
} from "@/utils/atoms/filters";
import { useSettings } from "@/utils/atoms/settings";

// Top-level renderer for a TV custom section in a collection
const CollectionSectionRenderer: React.FC<{
  section: any;
  index: number;
  collectionId: string;
}> = ({ section, index, collectionId }) => {
  const [api] = useAtom(apiAtom);
  const [user] = useAtom(userAtom);
  const resolver = section.items;
  const displayTitle = section.title || `Section ${index + 1}`;
  const qKey = [
    "tvSidebarSectionCollection",
    collectionId,
    displayTitle,
    resolver?.sortBy?.join("-") || "",
    resolver?.sortOrder?.join("-") || "",
    resolver?.includeItemTypes?.join("-") || "",
    String(resolver?.limit || ""),
  ];
  const { data: sectionItems } = useQuery({
    queryKey: qKey,
    queryFn: async () => {
      if (!api || !user?.Id || !resolver) return [] as BaseItemDto[];
      const response = await getItemsApi(api).getItems({
        userId: user.Id,
        parentId: collectionId,
        sortBy: resolver.sortBy as any,
        sortOrder: resolver.sortOrder as any,
        includeItemTypes: resolver.includeItemTypes as any,
        limit: resolver.limit ?? 20,
        recursive: true,
        fields: ["PrimaryImageAspectRatio"],
        enableImageTypes: ["Primary", "Thumb", "Backdrop"],
      });
      return response.data.Items || [];
    },
    staleTime: 60 * 1000,
    enabled: !!api && !!user?.Id && !!resolver,
  });
  if (!resolver) return null;
  const items = sectionItems || [];
  return (
    <View className='mb-6'>
      {displayTitle ? (
        <Text className='text-xl font-bold mb-2 px-4'>{displayTitle}</Text>
      ) : null}
      <FlashList
        horizontal={section.orientation === "horizontal"}
        // Disable vertical scrolling for nested lists to avoid nested scroll issues
        // FlashList forwards scrollEnabled to the underlying scroll view
        scrollEnabled={section.orientation === "horizontal"}
        estimatedItemSize={250}
        data={items}
        keyExtractor={(it: BaseItemDto) => it.Id || Math.random().toString()}
        renderItem={({ item }) => (
          <TouchableItemRouter
            key={item.Id}
            style={{ width: 180, marginHorizontal: 8 }}
            item={item}
          >
            <View style={{ width: 170 }}>
              <ItemPoster item={item} />
              <ItemCardText item={item} />
            </View>
          </TouchableItemRouter>
        )}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        ItemSeparatorComponent={() =>
          section.orientation === "horizontal" ? (
            <View style={{ width: 4 }} />
          ) : (
            <View style={{ height: 8 }} />
          )
        }
      />
    </View>
  );
};

const page: React.FC = () => {
  const searchParams = useLocalSearchParams();
  const { collectionId } = searchParams as { collectionId: string };

  const [api] = useAtom(apiAtom);
  const [user] = useAtom(userAtom);
  const navigation = useNavigation();
  const [orientation, _setOrientation] = useState(
    ScreenOrientation.Orientation.PORTRAIT_UP,
  );

  const { t } = useTranslation();

  const [selectedGenres, setSelectedGenres] = useAtom(genreFilterAtom);
  const [selectedYears, setSelectedYears] = useAtom(yearFilterAtom);

  const [selectedTags, setSelectedTags] = useAtom(tagsFilterAtom);
  const [sortBy, setSortBy] = useAtom(sortByAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);
  const { settings } = useSettings();

  // Detect if this collectionId is provided as a tvSidebarLink with custom sections (TV only)
  const tvCustomSections = useMemo(() => {
    if (!Platform.isTV) return undefined;
    const links = settings?.tvSidebarLinks || [];
    const found = links.find(
      (l) =>
        l.type === "collection" &&
        l.id === collectionId &&
        Array.isArray(l.sections),
    );
    if (__DEV__ && found) {
      // eslint-disable-next-line no-console
      console.log(
        "[TVCollection] using custom sections",
        collectionId,
        found.sections?.length,
      );
    }
    return found;
  }, [settings?.tvSidebarLinks, collectionId]);

  const { data: collection } = useQuery({
    queryKey: ["collection", collectionId],
    queryFn: async () => {
      if (!api) return null;
      const response = await getUserLibraryApi(api).getItem({
        itemId: collectionId,
        userId: user?.Id,
      });
      const data = response.data;
      return data;
    },
    enabled: !!api && !!user?.Id && !!collectionId,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    navigation.setOptions({ title: collection?.Name || "" });
    setSortOrder([SortOrderOption.Ascending]);

    if (!collection) return;

    // Convert the DisplayOrder to SortByOption
    const displayOrder = collection.DisplayOrder as ItemSortBy;
    const sortByOption = displayOrder
      ? SortByOption[displayOrder as keyof typeof SortByOption] ||
        SortByOption.PremiereDate
      : SortByOption.PremiereDate;

    setSortBy([sortByOption]);
  }, [navigation, collection]);

  const fetchItems = useCallback(
    async ({
      pageParam,
    }: {
      pageParam: number;
    }): Promise<BaseItemDtoQueryResult | null> => {
      if (!api || !collection) return null;

      const response = await getItemsApi(api).getItems({
        userId: user?.Id,
        parentId: collectionId,
        limit: 18,
        startIndex: pageParam,
        // Set one ordering at a time. As collections do not work with correctly with multiple.
        sortBy: [sortBy[0]],
        sortOrder: [sortOrder[0]],
        fields: [
          "ItemCounts",
          "PrimaryImageAspectRatio",
          "CanDelete",
          "MediaSourceCount",
        ],
        // true is needed for merged versions
        recursive: true,
        genres: selectedGenres,
        tags: selectedTags,
        years: selectedYears.map((year) => Number.parseInt(year, 10)),
        includeItemTypes: ["Movie", "Series"],
      });

      return response.data || null;
    },
    [
      api,
      user?.Id,
      collection,
      selectedGenres,
      selectedYears,
      selectedTags,
      sortBy,
      sortOrder,
    ],
  );

  const { data, isFetching, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: [
      "collection-items",
      collection,
      selectedGenres,
      selectedYears,
      selectedTags,
      sortBy,
      sortOrder,
    ],
    queryFn: fetchItems,
    getNextPageParam: (lastPage, pages) => {
      if (
        !lastPage?.Items ||
        !lastPage?.TotalRecordCount ||
        lastPage?.TotalRecordCount === 0
      )
        return undefined;

      const totalItems = lastPage.TotalRecordCount;
      const accumulatedItems = pages.reduce(
        (acc, curr) => acc + (curr?.Items?.length || 0),
        0,
      );

      if (accumulatedItems < totalItems) {
        return lastPage?.Items?.length * pages.length;
      }
      return undefined;
    },
    initialPageParam: 0,
    enabled: !!api && !!user?.Id && !!collection,
  });

  const flatData = useMemo(() => {
    return (
      (data?.pages.flatMap((p) => p?.Items).filter(Boolean) as BaseItemDto[]) ||
      []
    );
  }, [data]);

  const renderItem = useCallback(
    ({ item, index }: { item: BaseItemDto; index: number }) => (
      <TouchableItemRouter
        key={item.Id}
        style={{
          width: "100%",
          marginBottom:
            orientation === ScreenOrientation.Orientation.PORTRAIT_UP ? 4 : 16,
        }}
        item={item}
      >
        <View
          style={{
            alignSelf: (() => {
              const columns = Platform.isTV
                ? 6
                : orientation === ScreenOrientation.Orientation.PORTRAIT_UP
                  ? 3
                  : 5;
              if (index % columns === 0) return "flex-end";
              if ((index + 1) % columns === 0) return "flex-start";
              return "center";
            })(),
            width: "89%",
          }}
        >
          <ItemPoster item={item} />
          {/* <MoviePoster item={item} /> */}
          <ItemCardText item={item} />
        </View>
      </TouchableItemRouter>
    ),
    [orientation],
  );

  const keyExtractor = useCallback((item: BaseItemDto) => item.Id || "", []);

  const ListHeaderComponent = useCallback(
    () => (
      <View className=''>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            display: "flex",
            paddingHorizontal: 15,
            paddingVertical: 16,
            flexDirection: "row",
          }}
          extraData={[
            selectedGenres,
            selectedYears,
            selectedTags,
            sortBy,
            sortOrder,
          ]}
          data={[
            {
              key: "reset",
              component: <ResetFiltersButton />,
            },
            {
              key: "genre",
              component: (
                <FilterButton
                  className='mr-1'
                  id={collectionId}
                  queryKey='genreFilter'
                  queryFn={async () => {
                    if (!api) return null;
                    const response = await getFilterApi(
                      api,
                    ).getQueryFiltersLegacy({
                      userId: user?.Id,
                      parentId: collectionId,
                    });
                    return response.data.Genres || [];
                  }}
                  set={setSelectedGenres}
                  values={selectedGenres}
                  title={t("library.filters.genres")}
                  renderItemLabel={(item) => item.toString()}
                  searchFilter={(item, search) =>
                    item.toLowerCase().includes(search.toLowerCase())
                  }
                />
              ),
            },
            {
              key: "year",
              component: (
                <FilterButton
                  className='mr-1'
                  id={collectionId}
                  queryKey='yearFilter'
                  queryFn={async () => {
                    if (!api) return null;
                    const response = await getFilterApi(
                      api,
                    ).getQueryFiltersLegacy({
                      userId: user?.Id,
                      parentId: collectionId,
                    });
                    return response.data.Years || [];
                  }}
                  set={setSelectedYears}
                  values={selectedYears}
                  title={t("library.filters.years")}
                  renderItemLabel={(item) => item.toString()}
                  searchFilter={(item, search) => item.includes(search)}
                />
              ),
            },
            {
              key: "tags",
              component: (
                <FilterButton
                  className='mr-1'
                  id={collectionId}
                  queryKey='tagsFilter'
                  queryFn={async () => {
                    if (!api) return null;
                    const response = await getFilterApi(
                      api,
                    ).getQueryFiltersLegacy({
                      userId: user?.Id,
                      parentId: collectionId,
                    });
                    return response.data.Tags || [];
                  }}
                  set={setSelectedTags}
                  values={selectedTags}
                  title={t("library.filters.tags")}
                  renderItemLabel={(item) => item.toString()}
                  searchFilter={(item, search) =>
                    item.toLowerCase().includes(search.toLowerCase())
                  }
                />
              ),
            },
            {
              key: "sortBy",
              component: (
                <FilterButton
                  className='mr-1'
                  id={collectionId}
                  queryKey='sortBy'
                  queryFn={async () => sortOptions.map((s) => s.key)}
                  set={setSortBy}
                  values={sortBy}
                  title={t("library.filters.sort_by")}
                  renderItemLabel={(item) =>
                    sortOptions.find((i) => i.key === item)?.value || ""
                  }
                  searchFilter={(item, search) =>
                    item.toLowerCase().includes(search.toLowerCase())
                  }
                />
              ),
            },
            {
              key: "sortOrder",
              component: (
                <FilterButton
                  className='mr-1'
                  id={collectionId}
                  queryKey='sortOrder'
                  queryFn={async () => sortOrderOptions.map((s) => s.key)}
                  set={setSortOrder}
                  values={sortOrder}
                  title={t("library.filters.sort_order")}
                  renderItemLabel={(item) =>
                    sortOrderOptions.find((i) => i.key === item)?.value || ""
                  }
                  searchFilter={(item, search) =>
                    item.toLowerCase().includes(search.toLowerCase())
                  }
                />
              ),
            },
          ]}
          renderItem={({ item }) => item.component}
          keyExtractor={(item) => item.key}
        />
        {tvCustomSections?.sections?.length ? (
          <View style={{ paddingBottom: 12 }}>
            {tvCustomSections.sections.map((section, idx) => (
              <CollectionSectionRenderer
                key={`${collectionId}-sec-${idx}`}
                section={section}
                index={idx}
                collectionId={collectionId}
              />
            ))}
          </View>
        ) : null}
      </View>
    ),
    [
      collectionId,
      api,
      user?.Id,
      selectedGenres,
      setSelectedGenres,
      selectedYears,
      setSelectedYears,
      selectedTags,
      setSelectedTags,
      sortBy,
      setSortBy,
      sortOrder,
      setSortOrder,
      isFetching,
      tvCustomSections?.sections,
    ],
  );

  if (!collection) return null;

  // When custom sections are defined for TV, render them above the infinite list (in ListHeaderComponent)

  return (
    <FlashList
      ListEmptyComponent={
        <View className='flex flex-col items-center justify-center h-full'>
          <Text className='font-bold text-xl text-neutral-500'>
            {t("search.no_results")}
          </Text>
        </View>
      }
      extraData={[
        selectedGenres,
        selectedYears,
        selectedTags,
        sortBy,
        sortOrder,
      ]}
      contentInsetAdjustmentBehavior='automatic'
      data={flatData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={255}
      numColumns={
        Platform.isTV
          ? 6
          : orientation === ScreenOrientation.Orientation.PORTRAIT_UP
            ? 3
            : 5
      }
      onEndReached={() => {
        if (hasNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={ListHeaderComponent}
      contentContainerStyle={{ paddingBottom: 24 }}
      ItemSeparatorComponent={() => (
        <View
          style={{
            width: 10,
            height: 10,
          }}
        />
      )}
    />
  );
};

export default page;
