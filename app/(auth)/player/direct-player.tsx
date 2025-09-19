import {
  type BaseItemDto,
  type MediaSourceInfo,
  PlaybackOrder,
  PlaybackStartInfo,
  RepeatMode,
} from "@jellyfin/sdk/lib/generated-client";
import {
  getPlaystateApi,
  getUserLibraryApi,
} from "@jellyfin/sdk/lib/utils/api";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { router, useGlobalSearchParams, useNavigation } from "expo-router";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, View } from "react-native";
import { useAnimatedReaction, useSharedValue } from "react-native-reanimated";

import { BITRATES } from "@/components/BitrateSelector";
import { Text } from "@/components/common/Text";
import { Loader } from "@/components/Loader";
import ContinueWatchingOverlay from "@/components/video-player/controls/ContinueWatchingOverlay";
import { Controls } from "@/components/video-player/controls/Controls";
import TVControls from "@/components/video-player/tv/TVControls";
import { useHaptic } from "@/hooks/useHaptic";
import { useIntroSkipper } from "@/hooks/useIntroSkipper";
import { usePlaybackManager } from "@/hooks/usePlaybackManager";
import { useInvalidatePlaybackProgressCache } from "@/hooks/useRevalidatePlaybackProgressCache";
import { useWebSocket } from "@/hooks/useWebsockets";
import { VlcPlayerView } from "@/modules";
import type {
  PlaybackStatePayload,
  ProgressUpdatePayload,
  VlcPlayerViewRef,
} from "@/modules/VlcPlayer.types";
import { useDownload } from "@/providers/DownloadProvider";
import { DownloadedItem } from "@/providers/Downloads/types";
import { apiAtom, userAtom } from "@/providers/JellyfinProvider";
import { useSettings } from "@/utils/atoms/settings";
import { getDefaultPlaySettings } from "@/utils/jellyfin/getDefaultPlaySettings";
import { getStreamUrl } from "@/utils/jellyfin/media/getStreamUrl";
import { writeToLog } from "@/utils/log";
import { generateDeviceProfile } from "@/utils/profiles/native";
import { msToTicks, ticksToSeconds } from "@/utils/time";

export default function DirectPlayer() {
  const devLog = useCallback((...args: any[]) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[DirectPlayer]", ...args);
    }
  }, []);

  const videoRef = useRef<VlcPlayerViewRef>(null);
  const user = useAtomValue(userAtom);
  const api = useAtomValue(apiAtom);
  const { t } = useTranslation();
  const navigation = useNavigation();

  const [isPlaybackStopped, setIsPlaybackStopped] = useState(false);
  const [showControls, _setShowControls] = useState(!Platform.isTV);
  const [aspectRatio, setAspectRatio] = useState<
    "default" | "16:9" | "4:3" | "1:1" | "21:9"
  >("default");
  const [scaleFactor, setScaleFactor] = useState<
    1.0 | 1.1 | 1.2 | 1.3 | 1.4 | 1.5 | 1.6 | 1.7 | 1.8 | 1.9 | 2.0
  >(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [tvContinueVisible, setTvContinueVisible] = useState(false);
  const [currentTimeForHooks, setCurrentTimeForHooks] = useState(0);
  const lastSecondRef = useRef<number>(-1);

  const progress = useSharedValue(0);
  const isSeeking = useSharedValue(false);
  const cacheProgress = useSharedValue(0);
  const VolumeManager = Platform.isTV
    ? null
    : require("react-native-volume-manager");

  const downloadUtils = useDownload();
  const downloadedFiles = downloadUtils.getDownloadedItems();

  const revalidateProgressCache = useInvalidatePlaybackProgressCache();

  const lightHapticFeedback = useHaptic("light");

  const setShowControls = useCallback((show: boolean) => {
    _setShowControls(show);
    lightHapticFeedback();
  }, []);

  const {
    itemId,
    audioIndex: audioIndexStr,
    subtitleIndex: subtitleIndexStr,
    mediaSourceId,
    bitrateValue: bitrateValueStr,
    offline: offlineStr,
    playbackPosition: playbackPositionFromUrl,
  } = useGlobalSearchParams<{
    itemId: string;
    audioIndex: string;
    subtitleIndex: string;
    mediaSourceId: string;
    bitrateValue: string;
    offline: string;
    /** Playback position in ticks. */
    playbackPosition?: string;
  }>();
  const { settings, updateSettings } = useSettings();

  const offline = offlineStr === "true";
  const playbackManager = usePlaybackManager();

  const audioIndex = audioIndexStr
    ? Number.parseInt(audioIndexStr, 10)
    : undefined;
  const subtitleIndex = subtitleIndexStr
    ? Number.parseInt(subtitleIndexStr, 10)
    : -1;
  const bitrateValue = bitrateValueStr
    ? Number.parseInt(bitrateValueStr, 10)
    : BITRATES[0].value;

  const [item, setItem] = useState<BaseItemDto | null>(null);
  const [downloadedItem, setDownloadedItem] = useState<DownloadedItem | null>(
    null,
  );
  const [itemStatus, setItemStatus] = useState({
    isLoading: true,
    isError: false,
  });

  // Get adjacent items for autoplay/back navigation on TV (requires item state)
  const { nextItem } = usePlaybackManager({
    item: item ?? undefined,
    isOffline: offline,
  });

  /** Gets the initial playback position from the URL. */
  const getInitialPlaybackTicks = useCallback((): number => {
    if (playbackPositionFromUrl) {
      return Number.parseInt(playbackPositionFromUrl, 10);
    }
    return item?.UserData?.PlaybackPositionTicks ?? 0;
  }, [playbackPositionFromUrl]);

  useEffect(() => {
    const fetchItemData = async () => {
      setItemStatus({ isLoading: true, isError: false });
      try {
        let fetchedItem: BaseItemDto | null = null;
        if (offline && !Platform.isTV) {
          const data = downloadUtils.getDownloadedItemById(itemId);
          if (data) {
            fetchedItem = data.item as BaseItemDto;
            setDownloadedItem(data);
          }
        } else {
          const res = await getUserLibraryApi(api!).getItem({
            itemId,
            userId: user?.Id,
          });
          fetchedItem = res.data;
        }
        setItem(fetchedItem);
        setItemStatus({ isLoading: false, isError: false });
      } catch (error) {
        console.error("Failed to fetch item:", error);
        setItemStatus({ isLoading: false, isError: true });
      }
    };

    if (itemId) {
      fetchItemData();
    }
  }, [itemId, offline, api, user?.Id]);

  interface Stream {
    mediaSource: MediaSourceInfo;
    sessionId: string;
    url: string;
  }

  const [stream, setStream] = useState<Stream | null>(null);
  const [streamStatus, setStreamStatus] = useState({
    isLoading: true,
    isError: false,
  });

  useEffect(() => {
    const fetchStreamData = async () => {
      setStreamStatus({ isLoading: true, isError: false });
      try {
        // Don't attempt to fetch stream data if item is not available
        if (!item?.Id) {
          console.log("Item not loaded yet, skipping stream data fetch");
          setStreamStatus({ isLoading: false, isError: false });
          return;
        }

        let result: Stream | null = null;
        if (offline && downloadedItem && downloadedItem.mediaSource) {
          const url = downloadedItem.videoFilePath;
          if (item) {
            result = {
              mediaSource: downloadedItem.mediaSource,
              sessionId: "",
              url: url,
            };
          }
        } else {
          // Validate required parameters before calling getStreamUrl
          if (!api) {
            console.warn("API not available for streaming");
            setStreamStatus({ isLoading: false, isError: true });
            return;
          }
          if (!user?.Id) {
            console.warn("User not authenticated for streaming");
            setStreamStatus({ isLoading: false, isError: true });
            return;
          }

          const native = generateDeviceProfile();
          const transcoding = generateDeviceProfile({ transcode: true });
          const res = await getStreamUrl({
            api,
            item,
            startTimeTicks: getInitialPlaybackTicks(),
            userId: user.Id,
            audioStreamIndex: audioIndex,
            maxStreamingBitrate: bitrateValue,
            mediaSourceId: mediaSourceId,
            subtitleStreamIndex: subtitleIndex,
            deviceProfile: bitrateValue ? transcoding : native,
          });
          if (!res) return;
          const { mediaSource, sessionId, url } = res;
          if (!sessionId || !mediaSource || !url) {
            Alert.alert(
              t("player.error"),
              t("player.failed_to_get_stream_url"),
            );
            return;
          }
          result = { mediaSource, sessionId, url };
        }
        setStream(result);
        setStreamStatus({ isLoading: false, isError: false });
      } catch (error) {
        console.error("Failed to fetch stream:", error);
        setStreamStatus({ isLoading: false, isError: true });
      }
    };
    fetchStreamData();
  }, [
    itemId,
    mediaSourceId,
    bitrateValue,
    api,
    item,
    user?.Id,
    downloadedItem,
  ]);

  useEffect(() => {
    if (!stream || !api) return;
    const reportPlaybackStart = async () => {
      await getPlaystateApi(api).reportPlaybackStart({
        playbackStartInfo: currentPlayStateInfo() as PlaybackStartInfo,
      });
    };
    reportPlaybackStart();
  }, [stream, api]);

  const togglePlay = async () => {
    lightHapticFeedback();
    setIsPlaying(!isPlaying);
    if (isPlaying) {
      await videoRef.current?.pause();
      playbackManager.reportPlaybackProgress(
        item?.Id!,
        msToTicks(progress.get()),
        {
          AudioStreamIndex: audioIndex ?? -1,
          SubtitleStreamIndex: subtitleIndex ?? -1,
        },
      );
    } else {
      videoRef.current?.play();
      await getPlaystateApi(api!).reportPlaybackStart({
        playbackStartInfo: currentPlayStateInfo() as PlaybackStartInfo,
      });
    }
  };

  const reportPlaybackStopped = useCallback(async () => {
    const currentTimeInTicks = msToTicks(progress.get());
    await getPlaystateApi(api!).onPlaybackStopped({
      itemId: item?.Id!,
      mediaSourceId: mediaSourceId,
      positionTicks: currentTimeInTicks,
      playSessionId: stream?.sessionId!,
    });
  }, [
    api,
    item,
    mediaSourceId,
    stream,
    progress,
    offline,
    revalidateProgressCache,
  ]);

  const stop = useCallback(() => {
    // Update URL with final playback position before stopping
    router.setParams({
      playbackPosition: msToTicks(progress.get()).toString(),
    });
    reportPlaybackStopped();
    setIsPlaybackStopped(true);
    videoRef.current?.stop();
    revalidateProgressCache();
  }, [videoRef, reportPlaybackStopped, progress]);

  useEffect(() => {
    const beforeRemoveListener = navigation.addListener("beforeRemove", stop);
    return () => {
      beforeRemoveListener();
    };
  }, [navigation, stop]);

  const currentPlayStateInfo = useCallback(() => {
    if (!stream) return;
    return {
      itemId: item?.Id!,
      audioStreamIndex: audioIndex ? audioIndex : undefined,
      subtitleStreamIndex: subtitleIndex ? subtitleIndex : undefined,
      mediaSourceId: mediaSourceId,
      positionTicks: msToTicks(progress.get()),
      isPaused: !isPlaying,
      playMethod: stream?.url.includes("m3u8") ? "Transcode" : "DirectStream",
      playSessionId: stream.sessionId,
      isMuted: isMuted,
      canSeek: true,
      repeatMode: RepeatMode.RepeatNone,
      playbackOrder: PlaybackOrder.Default,
    };
  }, [
    stream,
    item?.Id,
    audioIndex,
    subtitleIndex,
    mediaSourceId,
    progress,
    isPlaying,
    isMuted,
  ]);

  const lastUrlUpdateTime = useSharedValue(0);
  const wasJustSeeking = useSharedValue(false);
  const URL_UPDATE_INTERVAL = 30000; // Update URL every 30 seconds instead of every second

  // Track when seeking ends to update URL immediately
  useAnimatedReaction(
    () => isSeeking.get(),
    (currentSeeking, previousSeeking) => {
      if (previousSeeking && !currentSeeking) {
        // Seeking just ended
        wasJustSeeking.value = true;
      }
    },
    [],
  );

  const onProgress = useCallback(
    async (data: ProgressUpdatePayload) => {
      if (isSeeking.get() || isPlaybackStopped) return;

      const { currentTime } = data.nativeEvent;
      const { duration } = data.nativeEvent;
      if (isBuffering) {
        setIsBuffering(false);
      }

      progress.set(currentTime);

      // Update per-second state for hooks (intro/credits skipper) without re-rendering every ms
      const currentSecond = Math.floor(currentTime / 1000);
      if (currentSecond !== lastSecondRef.current) {
        lastSecondRef.current = currentSecond;
        setCurrentTimeForHooks(currentTime);
      }

      // Update URL immediately after seeking, or every 30 seconds during normal playback
      const now = Date.now();
      const shouldUpdateUrl = wasJustSeeking.get();
      wasJustSeeking.value = false;

      if (
        shouldUpdateUrl ||
        now - lastUrlUpdateTime.get() > URL_UPDATE_INTERVAL
      ) {
        router.setParams({
          playbackPosition: msToTicks(currentTime).toString(),
        });
        lastUrlUpdateTime.value = now;
      }

      if (!item?.Id) return;

      playbackManager.reportPlaybackProgress(
        item.Id,
        msToTicks(progress.get()),
        {
          AudioStreamIndex: audioIndex ?? -1,
          SubtitleStreamIndex: subtitleIndex ?? -1,
        },
      );

      // Auto end-of-playback handling for TV: when we reach the end
      if (Platform.isTV) {
        maybeHandlePlaybackEnd(currentTime, duration);
      }
    },
    [
      item?.Id,
      audioIndex,
      subtitleIndex,
      mediaSourceId,
      isPlaying,
      stream,
      isSeeking,
      isPlaybackStopped,
      isBuffering,
    ],
  );

  /** Gets the initial playback position in seconds. */
  const startPosition = useMemo(() => {
    return ticksToSeconds(getInitialPlaybackTicks());
  }, [getInitialPlaybackTicks]);

  // TV: Skip Intro visibility/handler will be computed later after play/seek are defined

  // Helper: navigate to a specific item with preserved/derived media options
  const goToItemCommon = useCallback(
    (target: BaseItemDto) => {
      if (!target || !settings) return;

      const previousIndexes = {
        subtitleIndex: subtitleIndex ?? undefined,
        audioIndex: audioIndex ?? undefined,
      };

      const {
        mediaSource: newMediaSource,
        audioIndex: defaultAudioIndex,
        subtitleIndex: defaultSubtitleIndex,
      } = getDefaultPlaySettings(
        target,
        settings,
        previousIndexes,
        stream?.mediaSource ?? undefined,
      );

      const queryParams = new URLSearchParams({
        ...(offline && { offline: "true" }),
        itemId: target.Id ?? "",
        audioIndex: defaultAudioIndex?.toString() ?? "",
        subtitleIndex: defaultSubtitleIndex?.toString() ?? "",
        mediaSourceId: newMediaSource?.Id ?? "",
        bitrateValue: bitrateValue?.toString() ?? "",
        playbackPosition:
          target.UserData?.PlaybackPositionTicks?.toString() ?? "",
      }).toString();

      if (__DEV__) {
        console.log("[TV][goToItemCommon] navigating to item", {
          targetId: target.Id,
          targetType: target.Type,
          seriesId: target.SeriesId,
          name: target.Name,
          audioIndex: defaultAudioIndex,
          subtitleIndex: defaultSubtitleIndex,
          mediaSourceId: newMediaSource?.Id,
          offline,
        });
      }

      // Ensure we stop and report before navigating
      stop();
      // @ts-expect-error Expo Router typed string
      router.replace(`player/direct-player?${queryParams}`);
    },
    [
      settings,
      subtitleIndex,
      audioIndex,
      stream?.mediaSource,
      bitrateValue,
      offline,
      stop,
      router,
    ],
  );

  // Mirrors Controls.goToNextItem logic, respecting max auto-play setting
  const goToNextItem = useCallback(
    ({ isAutoPlay }: { isAutoPlay?: boolean }): boolean => {
      if (__DEV__) {
        console.log("[TV][goToNextItem] called", {
          isAutoPlay,
          hasNextItem: !!nextItem,
          settings: settings
            ? {
                autoPlayEpisodeCount: settings.autoPlayEpisodeCount,
                max: settings.maxAutoPlayEpisodeCount.value,
              }
            : null,
        });
      }
      if (!nextItem) return false;

      if (!isAutoPlay) {
        if (__DEV__)
          console.log("[TV][goToNextItem] manual advance to nextItem");
        goToItemCommon(nextItem);
        // Manual advance resets the counter
        updateSettings({ autoPlayEpisodeCount: 0 });
        return true;
      }

      // Autoplay path
      if (settings?.maxAutoPlayEpisodeCount.value === -1) {
        if (__DEV__)
          console.log("[TV][goToNextItem] autoplay unlimited, advancing");
        goToItemCommon(nextItem);
        return true;
      }

      if (
        settings &&
        settings.autoPlayEpisodeCount + 1 <
          settings.maxAutoPlayEpisodeCount.value
      ) {
        if (__DEV__)
          console.log("[TV][goToNextItem] autoplay within limit, advancing", {
            nextCount: settings.autoPlayEpisodeCount + 1,
            max: settings.maxAutoPlayEpisodeCount.value,
          });
        goToItemCommon(nextItem);
        // Will also increment below
        // but we've already navigated
        // Return true as navigation occurred
        // Increment counter next
        // fallthrough to increment
      }

      if (
        settings &&
        settings.autoPlayEpisodeCount < settings.maxAutoPlayEpisodeCount.value
      ) {
        if (__DEV__)
          console.log("[TV][goToNextItem] incrementing autoplay count");
        updateSettings({
          autoPlayEpisodeCount: settings.autoPlayEpisodeCount + 1,
        });
        return true; // navigation happened above or allowed
      }
      if (__DEV__)
        console.log("[TV][goToNextItem] autoplay limit reached, not advancing");
      return false; // limit reached, no navigation
    },
    [nextItem, goToItemCommon, settings, updateSettings],
  );

  // Track if we've already handled end-of-playback to avoid duplicate navigation
  const endHandledRef = useRef(false);
  useEffect(() => {
    endHandledRef.current = false;
    if (__DEV__)
      console.log("[TV][end] reset endHandledRef due to item change", item?.Id);
  }, [item?.Id]);

  const maybeHandlePlaybackEnd = useCallback(
    (current: number, total: number) => {
      if (endHandledRef.current) {
        if (__DEV__) console.log("[TV][end] already handled end, skipping");
        return;
      }
      if (!total || total <= 0) {
        if (__DEV__)
          console.log("[TV][end] missing/zero duration, skipping", { total });
        return;
      }
      // Treat end as within last 1 second
      const thresholdMs = 1000;
      const isEnd = current >= total - thresholdMs;

      if (isEnd) {
        endHandledRef.current = true;
        // Best-effort: mark played
        if (item?.Id) playbackManager.markItemPlayed(item.Id);
        if (item?.Type === "Episode" && nextItem) {
          const advanced = goToNextItem({ isAutoPlay: true });
          if (__DEV__)
            console.log("[TV][end] episode finished", {
              advanced,
              autoPlayEpisodeCount: settings?.autoPlayEpisodeCount,
              max: settings?.maxAutoPlayEpisodeCount.value,
            });
          if (!advanced) {
            // Respect settings limit on TV: show Continue Watching overlay instead of immediate back
            if (__DEV__)
              console.log(
                "[TV][end] not advancing, showing ContinueWatchingOverlay",
              );
            setTvContinueVisible(true);
          }
        } else {
          // Movie or no next episode -> go back
          if (__DEV__) console.log("[TV][end] movie/no-next, going back");
          stop();
          router.back();
        }
      }
    },
    [
      item?.Id,
      item?.Type,
      nextItem,
      playbackManager,
      goToNextItem,
      stop,
      router,
      settings?.autoPlayEpisodeCount,
      settings?.maxAutoPlayEpisodeCount.value,
    ],
  );

  const volumeUpCb = useCallback(async () => {
    if (Platform.isTV) return;

    try {
      const { volume: currentVolume } = await VolumeManager.getVolume();
      const newVolume = Math.min(currentVolume + 0.1, 1.0);

      await VolumeManager.setVolume(newVolume);
    } catch (error) {
      console.error("Error adjusting volume:", error);
    }
  }, []);
  const [previousVolume, setPreviousVolume] = useState<number | null>(null);

  const toggleMuteCb = useCallback(async () => {
    if (Platform.isTV) return;

    try {
      const { volume: currentVolume } = await VolumeManager.getVolume();
      const currentVolumePercent = currentVolume * 100;

      if (currentVolumePercent > 0) {
        // Currently not muted, so mute
        setPreviousVolume(currentVolumePercent);
        await VolumeManager.setVolume(0);
        setIsMuted(true);
      } else {
        // Currently muted, so restore previous volume
        const volumeToRestore = previousVolume || 50; // Default to 50% if no previous volume
        await VolumeManager.setVolume(volumeToRestore / 100);
        setPreviousVolume(null);
        setIsMuted(false);
      }
    } catch (error) {
      console.error("Error toggling mute:", error);
    }
  }, [previousVolume]);

  const volumeDownCb = useCallback(async () => {
    if (Platform.isTV) return;

    try {
      const { volume: currentVolume } = await VolumeManager.getVolume();
      const newVolume = Math.max(currentVolume - 0.1, 0); // Decrease by 10%
      console.log(
        "Volume Down",
        Math.round(currentVolume * 100),
        "→",
        Math.round(newVolume * 100),
      );
      await VolumeManager.setVolume(newVolume);
    } catch (error) {
      console.error("Error adjusting volume:", error);
    }
  }, []);

  const setVolumeCb = useCallback(async (newVolume: number) => {
    if (Platform.isTV) return;

    try {
      const clampedVolume = Math.max(0, Math.min(newVolume, 100));
      console.log("Setting volume to", clampedVolume);
      await VolumeManager.setVolume(clampedVolume / 100);
    } catch (error) {
      console.error("Error setting volume:", error);
    }
  }, []);

  useWebSocket({
    isPlaying: isPlaying,
    togglePlay: togglePlay,
    stopPlayback: stop,
    offline,
    toggleMute: toggleMuteCb,
    volumeUp: volumeUpCb,
    volumeDown: volumeDownCb,
    setVolume: setVolumeCb,
  });

  const onPlaybackStateChanged = useCallback(
    async (e: PlaybackStatePayload) => {
      const { state, isBuffering, isPlaying } = e.nativeEvent;
      if (state === "Playing") {
        setIsPlaying(true);
        if (item?.Id) {
          playbackManager.reportPlaybackProgress(
            item.Id,
            msToTicks(progress.get()),
            {
              AudioStreamIndex: audioIndex ?? -1,
              SubtitleStreamIndex: subtitleIndex ?? -1,
            },
          );
        }
        if (!Platform.isTV) await activateKeepAwakeAsync();
        return;
      }

      if (state === "Paused") {
        setIsPlaying(false);
        if (item?.Id) {
          playbackManager.reportPlaybackProgress(
            item.Id,
            msToTicks(progress.get()),
            {
              AudioStreamIndex: audioIndex ?? -1,
              SubtitleStreamIndex: subtitleIndex ?? -1,
            },
          );
        }
        if (!Platform.isTV) await deactivateKeepAwake();
        return;
      }

      if (isPlaying) {
        setIsPlaying(true);
        setIsBuffering(false);
      } else if (isBuffering) {
        setIsBuffering(true);
      }
    },
    [playbackManager, item?.Id, progress],
  );

  const allAudio =
    stream?.mediaSource.MediaStreams?.filter(
      (audio) => audio.Type === "Audio",
    ) || [];

  // Move all the external subtitles last, because vlc places them last.
  const allSubs =
    stream?.mediaSource.MediaStreams?.filter(
      (sub) => sub.Type === "Subtitle",
    ).sort((a, b) => Number(a.IsExternal) - Number(b.IsExternal)) || [];

  const externalSubtitles = allSubs
    .filter((sub: any) => sub.DeliveryMethod === "External")
    .map((sub: any) => ({
      name: sub.DisplayTitle,
      DeliveryUrl: offline ? sub.DeliveryUrl : api?.basePath + sub.DeliveryUrl,
    }));
  /** The text based subtitle tracks */
  const textSubs = allSubs.filter((sub) => sub.IsTextSubtitleStream);
  /** The user chosen subtitle track from the server */
  const chosenSubtitleTrack = allSubs.find(
    (sub) => sub.Index === subtitleIndex,
  );
  /** The user chosen audio track from the server */
  const chosenAudioTrack = allAudio.find((audio) => audio.Index === audioIndex);
  /** Whether the stream we're playing is not transcoding*/
  const notTranscoding = !stream?.mediaSource.TranscodingUrl;
  /** The initial options to pass to the VLC Player */
  const initOptions = [``];
  if (
    chosenSubtitleTrack &&
    (notTranscoding || chosenSubtitleTrack.IsTextSubtitleStream)
  ) {
    // If not transcoding, we can the index as normal.
    // If transcoding, we need to reverse the text based subtitles, because VLC reverses the HLS subtitles.
    const finalIndex = notTranscoding
      ? allSubs.indexOf(chosenSubtitleTrack)
      : [...textSubs].reverse().indexOf(chosenSubtitleTrack);
    initOptions.push(`--sub-track=${finalIndex}`);
  }

  if (notTranscoding && chosenAudioTrack) {
    initOptions.push(`--audio-track=${allAudio.indexOf(chosenAudioTrack)}`);
  }

  const [isMounted, setIsMounted] = useState(false);

  // Add useEffect to handle mounting
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Memoize video ref functions to prevent unnecessary re-renders
  const startPictureInPicture = useCallback(async () => {
    return videoRef.current?.startPictureInPicture?.();
  }, []);
  const play = useCallback(() => {
    videoRef.current?.play?.();
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause?.();
  }, []);

  const seek = useCallback((position: number) => {
    videoRef.current?.seekTo?.(position);
    devLog("seek: Seeking to position", position);
  }, []);
  const getAudioTracks = useCallback(async () => {
    devLog("getAudioTracks: Fetching audio tracks");
    return videoRef.current?.getAudioTracks?.() || null;
  }, []);

  const getSubtitleTracks = useCallback(async () => {
    devLog("getSubtitleTracks: Fetching subtitle tracks");
    return videoRef.current?.getSubtitleTracks?.() || null;
  }, []);

  const setSubtitleTrack = useCallback((index: number) => {
    devLog("setSubtitleTrack: Setting subtitle track:", index);
    videoRef.current?.setSubtitleTrack?.(index);
  }, []);

  const setSubtitleURL = useCallback((url: string, _customName?: string) => {
    // Note: VlcPlayer type only expects url parameter
    devLog("setSubtitleURL: Setting external subtitle URL:", url);
    videoRef.current?.setSubtitleURL?.(url);
  }, []);

  const setAudioTrack = useCallback((index: number) => {
    videoRef.current?.setAudioTrack?.(index);
  }, []);

  const setVideoAspectRatio = useCallback(
    async (aspectRatio: string | null) => {
      return (
        videoRef.current?.setVideoAspectRatio?.(aspectRatio) ||
        Promise.resolve()
      );
    },
    [],
  );

  const setVideoScaleFactor = useCallback(async (scaleFactor: number) => {
    return (
      videoRef.current?.setVideoScaleFactor?.(scaleFactor) || Promise.resolve()
    );
  }, []);

  //console.log("Debug: component render"); // Uncomment to debug re-renders

  // Compute Skip Intro visibility/action for TV using shared hook (requires play/seek)
  const { showSkipButton: showSkipIntroTV, skipIntro: skipIntroTV } =
    useIntroSkipper(
      item?.Id ?? "",
      currentTimeForHooks,
      seek,
      play,
      true,
      offline,
      api ?? null,
      downloadedFiles,
    );

  // Show error UI first, before checking loading/missing‐data
  if (itemStatus.isError || streamStatus.isError) {
    return (
      <View className='w-screen h-screen flex flex-col items-center justify-center bg-black'>
        <Text className='text-white'>{t("player.error")}</Text>
      </View>
    );
  }

  // Then show loader while either side is still fetching or data isn’t present
  if (itemStatus.isLoading || streamStatus.isLoading || !item || !stream) {
    // …loader UI…
    return (
      <View className='w-screen h-screen flex flex-col items-center justify-center bg-black'>
        <Loader />
      </View>
    );
  }

  if (itemStatus.isError || streamStatus.isError)
    return (
      <View className='w-screen h-screen flex flex-col items-center justify-center bg-black'>
        <Text className='text-white'>{t("player.error")}</Text>
      </View>
    );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "black",
        height: "100%",
        width: "100%",
      }}
      focusable={true}
      // isTVSelectable={true}
      // hasTVPreferredFocus={true}
    >
      <View
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          flexDirection: "column",
          justifyContent: "center",
        }}
        focusable={true}
        isTVSelectable={true}
      >
        <VlcPlayerView
          ref={videoRef}
          source={{
            uri: stream?.url || "",
            autoplay: true,
            isNetwork: !offline,
            startPosition,
            externalSubtitles,
            initOptions,
          }}
          style={{ width: "100%", height: "100%" }}
          onVideoProgress={onProgress}
          progressUpdateInterval={1000}
          onVideoStateChange={onPlaybackStateChanged}
          onVideoLoadEnd={() => {
            setIsVideoLoaded(true);
          }}
          onVideoError={(e) => {
            console.error("Video Error:", e.nativeEvent);
            Alert.alert(
              t("player.error"),
              t("player.an_error_occured_while_playing_the_video"),
            );
            writeToLog("ERROR", "Video Error", e.nativeEvent);
          }}
        />
      </View>
      {isMounted === true &&
        item &&
        (!Platform.isTV ? (
          <Controls
            mediaSource={stream?.mediaSource}
            item={item}
            videoRef={videoRef}
            togglePlay={togglePlay}
            isPlaying={isPlaying}
            isSeeking={isSeeking}
            progress={progress}
            cacheProgress={cacheProgress}
            isBuffering={isBuffering}
            showControls={showControls}
            setShowControls={setShowControls}
            isVideoLoaded={isVideoLoaded}
            startPictureInPicture={startPictureInPicture}
            play={play}
            pause={pause}
            seek={seek}
            enableTrickplay={true}
            getAudioTracks={getAudioTracks}
            getSubtitleTracks={getSubtitleTracks}
            offline={offline}
            setSubtitleTrack={setSubtitleTrack}
            setSubtitleURL={setSubtitleURL}
            setAudioTrack={setAudioTrack}
            setVideoAspectRatio={setVideoAspectRatio}
            setVideoScaleFactor={setVideoScaleFactor}
            aspectRatio={aspectRatio}
            scaleFactor={scaleFactor}
            setAspectRatio={setAspectRatio}
            setScaleFactor={setScaleFactor}
            isVlc
            api={api}
            downloadedFiles={downloadedFiles}
          />
        ) : (
          <TVControls
            mediaSource={stream?.mediaSource}
            item={item}
            togglePlay={togglePlay}
            isPlaying={isPlaying}
            isSeeking={isSeeking}
            progress={progress}
            cacheProgress={cacheProgress}
            isBuffering={isBuffering}
            showControls={showControls}
            setShowControls={setShowControls}
            isVideoLoaded={isVideoLoaded}
            play={play}
            pause={pause}
            seek={seek}
            offline={offline}
            isVlc
            getAudioTracks={getAudioTracks}
            getSubtitleTracks={getSubtitleTracks}
            setSubtitleTrack={setSubtitleTrack}
            setSubtitleURL={setSubtitleURL}
            setAudioTrack={setAudioTrack}
            showSkipIntroButton={showSkipIntroTV}
            onSkipIntro={skipIntroTV}
            api={api}
            downloadedFiles={downloadedFiles}
            nextItem={nextItem}
            handleNextEpisodeAutoPlay={() => {
              const advanced = goToNextItem({ isAutoPlay: true });
              if (!advanced) {
                // If settings prevent autoplay, ignore
              }
            }}
            handleNextEpisodeManual={() => {
              goToNextItem({ isAutoPlay: false });
            }}
          />
        ))}
      {Platform.isTV &&
        tvContinueVisible &&
        settings?.maxAutoPlayEpisodeCount.value !== -1 && (
          <ContinueWatchingOverlay
            goToNextItem={({ isAutoPlay, resetWatchCount }) => {
              // Proceed manually and reset watch count (component passes false/true)
              if (__DEV__)
                console.log("[TV][overlay] continue pressed", {
                  isAutoPlay,
                  resetWatchCount,
                });
              // Close overlay (navigation will replace anyway if advancing)
              setTvContinueVisible(false);
              // Advance manually; our goToNextItem ignores resetWatchCount flag, but manual path resets counter
              goToNextItem({ isAutoPlay: false });
            }}
          />
        )}
    </View>
  );
}
