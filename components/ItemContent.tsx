import type {
  BaseItemDto,
  MediaSourceInfo,
} from "@jellyfin/sdk/lib/generated-client/models";
import { Image } from "expo-image";
import { useNavigation } from "expo-router";
import { useAtom } from "jotai";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type Bitrate } from "@/components/BitrateSelector";
import { ItemImage } from "@/components/common/ItemImage";
import { DownloadSingleItem } from "@/components/DownloadItem";
import { OverviewText } from "@/components/OverviewText";
import { ParallaxScrollView } from "@/components/ParallaxPage";
// const PlayButton = !Platform.isTV ? require("@/components/PlayButton") : null;
import { PlayButton } from "@/components/PlayButton";
import { PlayedStatus } from "@/components/PlayedStatus";
import { SimilarItems } from "@/components/SimilarItems";
import { CastAndCrew } from "@/components/series/CastAndCrew";
import { CurrentSeries } from "@/components/series/CurrentSeries";
import { SeasonEpisodesCarousel } from "@/components/series/SeasonEpisodesCarousel";
import useDefaultPlaySettings from "@/hooks/useDefaultPlaySettings";
import { useImageColors } from "@/hooks/useImageColors";
import { useOrientation } from "@/hooks/useOrientation";
import * as ScreenOrientation from "@/packages/expo-screen-orientation";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import { useSettings } from "@/utils/atoms/settings";
import { getLogoImageUrlById } from "@/utils/jellyfin/image/getLogoImageUrlById";
import { AddToFavorites } from "./AddToFavorites";
import { BitrateSheet } from "./BitRateSheet";
import { ItemHeader } from "./ItemHeader";
import { ItemTechnicalDetails } from "./ItemTechnicalDetails";
import { MediaSourceSheet } from "./MediaSourceSheet";
import { MoreMoviesWithActor } from "./MoreMoviesWithActor";
import { PlayInRemoteSessionButton } from "./PlayInRemoteSession";
import { TrackSheet } from "./TrackSheet";

const Chromecast = !Platform.isTV ? require("./Chromecast") : null;

export type SelectedOptions = {
  bitrate: Bitrate;
  mediaSource: MediaSourceInfo | undefined;
  audioIndex: number | undefined;
  subtitleIndex: number;
};

interface ItemContentProps {
  item: BaseItemDto;
  isOffline: boolean;
}

export const ItemContent: React.FC<ItemContentProps> = React.memo(
  ({ item, isOffline }) => {
    const devLog = React.useCallback((...args: any[]) => {
      if (__DEV__) console.log("[ItemContent]", ...args);
    }, []);
    const renderCountRef = useRef(0);
    renderCountRef.current += 1;
    devLog("render", {
      count: renderCountRef.current,
      itemId: item?.Id,
      isTV: Platform.isTV,
      isOffline,
    });
    const [api] = useAtom(apiAtom);
    const { settings } = useSettings();
    const { orientation } = useOrientation();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [user] = useAtom(userAtom);
    const { t } = useTranslation();

    useImageColors({ item });

    const [loadingLogo, setLoadingLogo] = useState(true);
    const [headerHeight, setHeaderHeight] = useState(350);

    const [selectedOptions, setSelectedOptions] = useState<
      SelectedOptions | undefined
    >(undefined);

    const {
      defaultAudioIndex,
      defaultBitrate,
      defaultMediaSource,
      defaultSubtitleIndex,
    } = useDefaultPlaySettings(item!, settings);
    useEffect(() => {
      devLog("useDefaultPlaySettings changed", {
        defaultAudioIndex,
        defaultBitrate,
        defaultMediaSourceId: defaultMediaSource?.Id,
        defaultSubtitleIndex,
      });
    }, [
      defaultAudioIndex,
      defaultBitrate,
      defaultMediaSource,
      defaultSubtitleIndex,
    ]);

    const logoUrl = useMemo(
      () => (item ? getLogoImageUrlById({ api, item }) : null),
      [api, item],
    );

    const loading = useMemo(() => {
      return Boolean(logoUrl && loadingLogo);
    }, [loadingLogo, logoUrl]);

    // Helper to avoid redundant state updates
    const areSelectedOptionsEqual = useCallback(
      (a: SelectedOptions | undefined, b: SelectedOptions | undefined) => {
        if (a === b) return true;
        if (!a || !b) return false;
        return (
          a.bitrate === b.bitrate &&
          (a.mediaSource?.Id ?? a.mediaSource) ===
            (b.mediaSource?.Id ?? b.mediaSource) &&
          (a.audioIndex ?? -999) === (b.audioIndex ?? -999) &&
          (a.subtitleIndex ?? -1) === (b.subtitleIndex ?? -1)
        );
      },
      [],
    );

    // Needs to automatically change the selected to the default values for default indexes, but avoid no-op updates.
    useEffect(() => {
      const next: SelectedOptions = {
        bitrate: defaultBitrate,
        mediaSource: defaultMediaSource,
        subtitleIndex: defaultSubtitleIndex ?? -1,
        audioIndex: defaultAudioIndex,
      };
      setSelectedOptions((prev) => {
        const equal = areSelectedOptionsEqual(prev, next);
        if (equal) return prev!;
        devLog("selectedOptions -> defaults", {
          from: {
            bitrate: prev?.bitrate,
            mediaSourceId: prev?.mediaSource?.Id,
            audioIndex: prev?.audioIndex,
            subtitleIndex: prev?.subtitleIndex,
          },
          to: {
            bitrate: next.bitrate,
            mediaSourceId: next.mediaSource?.Id,
            audioIndex: next.audioIndex,
            subtitleIndex: next.subtitleIndex,
          },
        });
        return next;
      });
    }, [
      defaultAudioIndex,
      defaultBitrate,
      defaultSubtitleIndex,
      defaultMediaSource,
      areSelectedOptionsEqual,
      devLog,
    ]);

    // Log selectedOptions changes for profiling
    useEffect(() => {
      if (!selectedOptions) return;
      devLog("selectedOptions changed", {
        bitrate: selectedOptions.bitrate,
        mediaSourceId: selectedOptions.mediaSource?.Id,
        audioIndex: selectedOptions.audioIndex,
        subtitleIndex: selectedOptions.subtitleIndex,
      });
    }, [selectedOptions]);

    useEffect(() => {
      if (Platform.isTV) return;
      navigation.setOptions({
        headerRight: () =>
          item && (
            <View className='flex flex-row items-center space-x-2'>
              <Chromecast.Chromecast background='blur' width={22} height={22} />
              {item.Type !== "Program" && (
                <View className='flex flex-row items-center space-x-2'>
                  {!Platform.isTV && (
                    <DownloadSingleItem item={item} size='large' />
                  )}
                  {user?.Policy?.IsAdministrator && (
                    <PlayInRemoteSessionButton item={item} size='large' />
                  )}

                  <PlayedStatus items={[item]} size='large' />
                  <AddToFavorites item={item} />
                </View>
              )}
            </View>
          ),
      });
    }, [item, navigation, user]);

    useEffect(() => {
      if (Platform.isTV) return;
      if (!item) return;
      let next = 350;
      if (orientation !== ScreenOrientation.OrientationLock.PORTRAIT_UP)
        next = 230;
      else if (item.Type === "Movie") next = 500;
      if (next !== headerHeight) {
        setHeaderHeight(next);
      }
    }, [item, orientation, headerHeight]);

    // Memoized nodes and handlers must be declared before any early return to satisfy Rules of Hooks
    const headerImageNode = useMemo(
      () => (
        <View style={[{ flex: 1 }]}>
          <ItemImage
            variant={item.Type === "Movie" && logoUrl ? "Backdrop" : "Primary"}
            item={item}
            style={{ width: "100%", height: "100%" }}
          />
        </View>
      ),
      [item, logoUrl],
    );

    const logoNode = useMemo(
      () =>
        logoUrl ? (
          <Image
            source={{ uri: logoUrl }}
            style={{ height: 130, width: "100%" }}
            contentFit='contain'
            onLoad={() => {
              if (loadingLogo) setLoadingLogo(false);
            }}
            onError={() => {
              if (loadingLogo) setLoadingLogo(false);
            }}
          />
        ) : (
          <View />
        ),
      [logoUrl, loadingLogo],
    );

    const handleBitrateChange = useCallback(
      (val: Bitrate) => {
        setSelectedOptions((prev) => {
          if (!prev) return prev;
          if (prev.bitrate === val) return prev;
          const next = { ...prev, bitrate: val } as SelectedOptions;
          devLog("bitrate changed", { from: prev.bitrate, to: val });
          return next;
        });
      },
      [devLog],
    );

    const handleMediaSourceChange = useCallback(
      (val: MediaSourceInfo | undefined) => {
        setSelectedOptions((prev) => {
          if (!prev) return prev;
          const prevId = prev.mediaSource?.Id;
          const nextId = val?.Id;
          if (prevId === nextId) return prev;
          const next = { ...prev, mediaSource: val } as SelectedOptions;
          devLog("mediaSource changed", { fromId: prevId, toId: nextId });
          return next;
        });
      },
      [devLog],
    );

    const handleAudioChange = useCallback(
      (val: number | undefined) => {
        setSelectedOptions((prev) => {
          if (!prev) return prev;
          if (prev.audioIndex === val) return prev;
          const next = { ...prev, audioIndex: val } as SelectedOptions;
          devLog("audioIndex changed", { from: prev.audioIndex, to: val });
          return next;
        });
      },
      [devLog],
    );

    const handleSubtitleChange = useCallback(
      (val: number) => {
        setSelectedOptions((prev) => {
          if (!prev) return prev;
          if (prev.subtitleIndex === val) return prev;
          const next = { ...prev, subtitleIndex: val } as SelectedOptions;
          devLog("subtitleIndex changed", {
            from: prev.subtitleIndex,
            to: val,
          });
          return next;
        });
      },
      [devLog],
    );

    if (!item || !selectedOptions) return null;

    return (
      <View
        className='flex-1 relative'
        style={{
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
      >
        <ParallaxScrollView
          className={`flex-1 ${loading ? "opacity-0" : "opacity-100"}`}
          headerHeight={headerHeight}
          headerImage={headerImageNode}
          logo={logoNode}
        >
          <View className='flex flex-col bg-transparent shrink'>
            <View className='flex flex-col px-4 w-full space-y-2 pt-2 mb-2 shrink'>
              <ItemHeader item={item} className='mb-2' />
              {item.Type !== "Program" && !Platform.isTV && !isOffline && (
                <View className='flex flex-row items-center justify-start w-full h-16'>
                  <BitrateSheet
                    className='mr-1'
                    onChange={handleBitrateChange}
                    selected={selectedOptions.bitrate}
                  />
                  <MediaSourceSheet
                    className='mr-1'
                    item={item}
                    onChange={handleMediaSourceChange}
                    selected={selectedOptions.mediaSource}
                  />
                  <TrackSheet
                    className='mr-1'
                    streamType='Audio'
                    title={t("item_card.audio")}
                    source={selectedOptions.mediaSource}
                    onChange={handleAudioChange}
                    selected={selectedOptions.audioIndex}
                  />
                  <TrackSheet
                    source={selectedOptions.mediaSource}
                    streamType='Subtitle'
                    title={t("item_card.subtitles")}
                    onChange={handleSubtitleChange}
                    selected={selectedOptions.subtitleIndex}
                  />
                </View>
              )}

              <PlayButton
                className='grow'
                selectedOptions={selectedOptions}
                item={item}
                isOffline={isOffline}
                hasTVPreferredFocus={Platform.isTV}
              />
            </View>

            {item.Type === "Episode" && (
              <SeasonEpisodesCarousel
                item={item}
                loading={loading}
                isOffline={isOffline}
                className={`mb-4 ${Platform.isTV ? "mt-4" : ""}`}
              />
            )}

            {!isOffline && !Platform.isTV && (
              <ItemTechnicalDetails source={selectedOptions.mediaSource} />
            )}
            <OverviewText
              text={item.Overview}
              className={`px-4 mb-4 ${Platform.isTV ? "mt-4" : ""}`}
            />

            {item.Type !== "Program" && (
              <>
                {item.Type === "Episode" && !isOffline && (
                  <CurrentSeries item={item} className='mb-4' />
                )}

                {!isOffline && (
                  <CastAndCrew item={item} className='mb-4' loading={loading} />
                )}

                {item.People && item.People.length > 0 && !isOffline && (
                  <View className='mb-4'>
                    {item.People.slice(0, 3).map((person, idx) => (
                      <MoreMoviesWithActor
                        currentItem={item}
                        key={idx}
                        actorId={person.Id!}
                        className='mb-4'
                      />
                    ))}
                  </View>
                )}

                {!isOffline && <SimilarItems itemId={item.Id} />}
              </>
            )}
          </View>
        </ParallaxScrollView>
      </View>
    );
  },
);
