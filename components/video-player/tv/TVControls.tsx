import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import type { Api } from "@jellyfin/sdk";
import type {
  BaseItemDto,
  MediaSourceInfo,
} from "@jellyfin/sdk/lib/generated-client";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BackHandler,
  Platform,
  TVEventControl,
  useTVEventHandler,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ModalActionSheet } from "@/components/actionsheet/ModalActionSheet";
import { FocusableItem } from "@/components/common/FocusableItem";
import { Text } from "@/components/common/Text";
import { Loader } from "@/components/Loader";
import {
  CONTROLS_CONSTANTS,
  ICON_SIZES,
} from "@/components/video-player/controls/constants";
import { ControlProvider } from "@/components/video-player/controls/contexts/ControlContext";
import {
  useVideoContext,
  VideoProvider,
} from "@/components/video-player/controls/contexts/VideoContext";
import { EpisodeList } from "@/components/video-player/controls/EpisodeList";
import { useVideoNavigation } from "@/components/video-player/controls/hooks/useVideoNavigation";
import { useVideoSlider } from "@/components/video-player/controls/hooks/useVideoSlider";
import { useVideoTime } from "@/components/video-player/controls/hooks/useVideoTime";
import { TimeDisplay } from "@/components/video-player/controls/TimeDisplay";
import { TrickplayBubble } from "@/components/video-player/controls/TrickplayBubble";
import { Colors } from "@/constants/Colors";
import { usePlaybackManager } from "@/hooks/usePlaybackManager";
import { useTrickplay } from "@/hooks/useTrickplay";
import type { DownloadedItem } from "@/providers/Downloads/types";
import { getPrimaryImageUrl } from "@/utils/jellyfin/image/getPrimaryImageUrl";
import { useSegments } from "@/utils/segments";
import { secondsToMs, secondsToTicks, ticksToMs } from "@/utils/time";
import TVSlider from "./TVSlider";

// Top-level component for Subtitle selection sheet (avoid nested component lint issues)
const SubtitleActionSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  const { subtitleTracks } = useVideoContext();
  const { subtitleIndex } = useLocalSearchParams<{ subtitleIndex: string }>();

  const options = (subtitleTracks || []).map((sub) => ({
    title: sub.name,
    onPress: () => sub.setTrack(),
    icon: (
      <Ionicons
        name={
          subtitleIndex === sub.index.toString()
            ? "radio-button-on"
            : "radio-button-off"
        }
        size={20}
        color='white'
      />
    ),
  }));

  return (
    <ModalActionSheet
      title='Subtitles'
      options={options}
      cancelButtonTitle='Close'
      visible={visible}
      onCancel={onClose}
      onDismiss={onClose}
    />
  );
};

// Top-level component for Audio track selection sheet
const AudioActionSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  const { audioTracks } = useVideoContext();
  const { audioIndex } = useLocalSearchParams<{ audioIndex: string }>();

  const options = (audioTracks || []).map((track) => ({
    title: track.name,
    onPress: () => track.setTrack(),
    icon: (
      <Ionicons
        name={
          audioIndex === track.index.toString()
            ? "radio-button-on"
            : "radio-button-off"
        }
        size={20}
        color='white'
      />
    ),
  }));

  return (
    <ModalActionSheet
      title='Audio'
      options={options}
      cancelButtonTitle='Close'
      visible={visible}
      onCancel={onClose}
      onDismiss={onClose}
    />
  );
};

type TVControlsProps = {
  mediaSource?: MediaSourceInfo | null;
  item: BaseItemDto;
  // player interactions
  togglePlay: () => void;
  isPlaying: boolean;
  isSeeking: any; // SharedValue<boolean>
  progress: any; // SharedValue<number> (ms for VLC)
  cacheProgress: any; // SharedValue<number>
  isBuffering: boolean;
  showControls: boolean;
  setShowControls: (show: boolean) => void;
  isVideoLoaded: boolean; // currently unused in TV overlay
  play: () => void;
  pause: () => void;
  seek: (position: number) => void;
  offline: boolean; // currently unused in TV overlay
  aspectRatio?: any;
  scaleFactor?: any;
  setAspectRatio?: any;
  setScaleFactor?: any;
  isVlc?: boolean;
  // track controls (optional, for VideoProvider)
  getAudioTracks?: (() => Promise<any[] | null>) | (() => any[]);
  getSubtitleTracks?: (() => Promise<any[] | null>) | (() => any[]);
  setAudioTrack?: (index: number) => void;
  setSubtitleTrack?: (index: number) => void;
  setSubtitleURL?: (url: string, customName: string) => void;
  // Skip Intro support (optional)
  showSkipIntroButton?: boolean;
  onSkipIntro?: () => void;
  // For fetching segments (optional)
  api?: Api | null;
  downloadedFiles?: DownloadedItem[] | undefined;
  // Next episode overlay (TV)
  nextItem?: BaseItemDto | null;
  handleNextEpisodeAutoPlay?: () => void;
  handleNextEpisodeManual?: () => void;
};

export const TVControls: React.FC<TVControlsProps> = ({
  item,
  togglePlay,
  isPlaying,
  isSeeking,
  progress,
  cacheProgress,
  isBuffering,
  showControls,
  setShowControls,
  // isVideoLoaded,
  play,
  pause,
  seek,
  offline,
  isVlc = true,
  mediaSource,
  isVideoLoaded,
  getAudioTracks,
  getSubtitleTracks,
  setAudioTrack,
  setSubtitleTrack,
  setSubtitleURL,
  showSkipIntroButton = false,
  onSkipIntro,
  api,
  downloadedFiles,
  nextItem,
  handleNextEpisodeAutoPlay,
  handleNextEpisodeManual,
}) => {
  const devLog = useCallback((...args: any[]) => {
    if (__DEV__) console.log("[TVControls]", ...args);
  }, []);
  const insets = useSafeAreaInsets();
  usePlaybackManager();
  const { t } = useTranslation();

  // animation for overlay visibility
  const overlayOpacity = useSharedValue(showControls ? 1 : 0);
  const mainTranslateY = useSharedValue(0); // slides up when episodes are open
  // fade animation specifically for the Skip Intro pill
  const skipOpacity = useSharedValue(0);
  const [episodesOpen, setEpisodesOpen] = useState(false);
  const [preferPlayFocus, setPreferPlayFocus] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    overlayOpacity.value = withTiming(showControls ? 1 : 0, { duration: 180 });
    if (showControls) {
      // next tick prefer focus on Play/Pause
      setTimeout(() => setPreferPlayFocus(true), 0);
    } else {
      setPreferPlayFocus(false);
    }
  }, [showControls]);

  useEffect(() => {
    if (showSkipIntroButton) {
      setPreferPlayFocus(false);
    }
  }, [showSkipIntroButton]);

  // (Removed: replaced below with guarded auto-show using skipPressedRef)

  // Slide main content up/down when episodes toggled
  useEffect(() => {
    mainTranslateY.value = withTiming(episodesOpen ? -120 : 0, {
      duration: 220,
    });
  }, [episodesOpen]);

  // Auto-hide timer management (TV-specific)
  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));
  const mainStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: mainTranslateY.value }],
  }));

  // Skip Intro fade animation
  useEffect(() => {
    skipOpacity.value = withTiming(showSkipIntroButton ? 1 : 0, {
      duration: 150,
    });
  }, [showSkipIntroButton]);
  const skipAnimStyle = useAnimatedStyle(() => ({
    opacity: skipOpacity.value,
  }));

  // Trickplay support and slider hooks
  const { trickPlayUrl, trickplayInfo, calculateTrickplayUrl } =
    useTrickplay(item);
  const {
    isSliding,
    time,
    handleSliderStart,
    handleSliderComplete,
    handleSliderChange,
  } = useVideoSlider({
    progress,
    isSeeking,
    isPlaying,
    isVlc: !!isVlc,
    seek,
    play,
    pause,
    calculateTrickplayUrl,
    showControls,
  });

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    // Only schedule when controls are visible, not sliding, episodes list closed, and playing
    if (!showControls || isSliding || episodesOpen || !isPlaying) return;
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, CONTROLS_CONSTANTS.TIMEOUT);
  }, [
    clearHideTimer,
    showControls,
    isSliding,
    episodesOpen,
    isPlaying,
    setShowControls,
  ]);

  const handleControlsInteraction = useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);

  // Recalculate timer whenever relevant state changes
  useEffect(() => {
    scheduleHide();
    return () => clearHideTimer();
  }, [scheduleHide, clearHideTimer]);

  // Android TV: intercept hardware back to hide overlay instead of navigating back
  useEffect(() => {
    const onBackPress = () => {
      if (showControls) {
        setShowControls(false);
        return true; // consume event
      }
      return false; // allow default navigation
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [showControls, setShowControls]);

  // tvOS: disable the Menu key default back behavior while overlay is visible
  useEffect(() => {
    if (Platform.isTV && Platform.OS === "ios") {
      try {
        if (showControls) {
          TVEventControl.disableTVMenuKey?.();
        } else {
          TVEventControl.enableTVMenuKey?.();
        }
      } catch {
        // no-op: API not available on this platform/runtime
      }
      return () => {
        try {
          TVEventControl.enableTVMenuKey?.();
        } catch {
          // ignore
        }
      };
    }
  }, [showControls]);

  const min = useSharedValue(0);
  const max = useSharedValue(item.RunTimeTicks || 0);
  const { currentTime, remainingTime } = useVideoTime({
    progress,
    max,
    isSeeking,
    isVlc,
  });

  // Compute current seconds for segment checks
  const currentSeconds = React.useMemo(
    () => (isVlc ? Math.floor(currentTime / 1000) : Math.floor(currentTime)),
    [currentTime, isVlc],
  );

  // Fetch intro segments for highlighting on the slider (optional)
  const { data: segData } = useSegments(
    item?.Id ?? "",
    !!offline,
    downloadedFiles,
    api ?? null,
  );
  const sliderSegments = React.useMemo(() => {
    const intro = segData?.introSegments ?? [];
    const credits = segData?.creditSegments ?? [];
    const mapSegments = (
      arr: { startTime: number; endTime: number }[],
      color: string,
    ) =>
      arr
        .filter(
          (s) => Number.isFinite(s.startTime) && Number.isFinite(s.endTime),
        )
        .map((s) => ({
          start: isVlc ? secondsToMs(s.startTime) : secondsToTicks(s.startTime),
          end: isVlc ? secondsToMs(s.endTime) : secondsToTicks(s.endTime),
          color,
        }));
    return [
      ...mapSegments(intro, "rgba(38, 249, 108, 0.6)"),
      ...mapSegments(credits, "rgba(255, 215, 0, 0.6)"),
    ] as { start: number; end: number; color?: string }[];
  }, [segData?.introSegments, segData?.creditSegments, isVlc]);

  // --- Next Episode Preview Overlay state and timers ---
  const [showNextOverlay, setShowNextOverlay] = useState(false);
  const [overlayCancelled, setOverlayCancelled] = useState(false);
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(
    CONTROLS_CONSTANTS.TIMEOUT_BEFORE_AUTO_SKIP_CREDITS_MS,
  );
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const clearOverlayTimers = useCallback(() => {
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // --- Next Episode Overlay timing (pre-credits and during credits) ---
  const creditSeg = segData?.creditSegments?.[0];
  const preSeconds =
    CONTROLS_CONSTANTS.TIME_BEFORE_SKIP_CREDITS_OVERLAY_MS / 1000;
  const creditStart = creditSeg ? Math.floor(creditSeg.startTime) : null;
  const creditEnd = creditSeg ? Math.ceil(creditSeg.endTime) : null;
  const preWindowStart =
    creditStart != null ? Math.max(0, creditStart - preSeconds) : null;

  const inCredits = React.useMemo(() => {
    if (creditStart == null || creditEnd == null) return false;
    return currentSeconds >= creditStart && currentSeconds <= creditEnd;
  }, [creditStart, creditEnd, currentSeconds]);

  const inPreWindow = React.useMemo(() => {
    if (preWindowStart == null || creditStart == null) return false;
    return currentSeconds >= preWindowStart && currentSeconds <= creditStart;
  }, [preWindowStart, creditStart, currentSeconds]);

  useEffect(() => {
    const inWindow = (inPreWindow || inCredits) && !!nextItem;

    if (!inWindow) {
      setOverlayCancelled(false);
      if (showNextOverlay) setShowNextOverlay(false);
      clearOverlayTimers();
      return;
    }

    if (
      !overlayCancelled &&
      !showNextOverlay &&
      preWindowStart != null &&
      currentSeconds >= preWindowStart
    ) {
      setShowNextOverlay(true);
      setRemainingMs(CONTROLS_CONSTANTS.TIMEOUT_BEFORE_AUTO_SKIP_CREDITS_MS);
      const startedAt = Date.now();
      const total = CONTROLS_CONSTANTS.TIMEOUT_BEFORE_AUTO_SKIP_CREDITS_MS;
      countdownIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        setRemainingMs(Math.max(0, total - elapsed));
      }, 200);
      overlayTimeoutRef.current = setTimeout(() => {
        clearOverlayTimers();
        handleNextEpisodeAutoPlay?.();
      }, total);
    }
  }, [
    inPreWindow,
    inCredits,
    nextItem,
    overlayCancelled,
    showNextOverlay,
    preWindowStart,
    currentSeconds,
    clearOverlayTimers,
    handleNextEpisodeAutoPlay,
  ]);

  // Cleanup when component unmounts or item changes
  useEffect(() => clearOverlayTimers, [clearOverlayTimers]);

  const cancelAutoSkip = useCallback(() => {
    setOverlayCancelled(true);
    setShowNextOverlay(false);
    clearOverlayTimers();
  }, [clearOverlayTimers]);

  const playNextNow = useCallback(() => {
    clearOverlayTimers();
    handleNextEpisodeManual?.();
  }, [handleNextEpisodeManual, clearOverlayTimers]);

  const nextPreviewUrl = React.useMemo(() => {
    if (!api || !nextItem) return null;
    try {
      return getPrimaryImageUrl({
        api,
        item: nextItem,
        quality: 80,
        width: 360,
      });
    } catch {
      return null;
    }
  }, [api, nextItem]);

  const secondsLeft = Math.ceil(remainingMs / 1000);

  // Initialize progress and max in the correct units (ms for VLC, ticks otherwise)
  useEffect(() => {
    if (!item) return;
    max.value = isVlc
      ? ticksToMs(item.RunTimeTicks || 0)
      : item.RunTimeTicks || 0;
    const initialPos = item?.UserData?.PlaybackPositionTicks || 0;
    progress.value = isVlc ? ticksToMs(initialPos) : initialPos;
  }, [item, isVlc, max, progress]);

  // Remote keys visibility gate
  useTVEventHandler((evt) => {
    if (!evt) return;
    const type = evt.eventType;
    devLog("TV event", type);

    // Consider only direct user inputs for showing controls
    const userInputTypes = new Set([
      "up",
      "down",
      "left",
      "right",
      "select",
      "playPause",
      "menu",
      "back",
      "rewind",
      "fastForward",
    ]);

    // If overlay hidden, only show on explicit user input (ignore focus/blur)
    if (!showControls) {
      if (type === "playPause") {
        togglePlay();
      }
      if (userInputTypes.has(type)) {
        setShowControls(true);
      }
      return;
    }

    // When visible, intercept back/menu to hide overlay; handle play/pause here; rest handled by focus chain
    if (type === "playPause") {
      togglePlay();
      return;
    }
    if (type === "menu" || type === "back") {
      setShowControls(false);
      return;
    }
  });

  // Timer scheduling is handled locally via scheduleHide/handleControlsInteraction

  // seek skip handlers
  const { handleSkipBackward, handleSkipForward } = useVideoNavigation({
    progress,
    isPlaying,
    isVlc,
    seek,
    play,
  });

  const title =
    item?.Type === "Episode" ? (item.SeriesName ?? "") : (item?.Name ?? "");
  const subtitle =
    item?.Type === "Episode"
      ? (item.Name ?? "")
      : (item?.ProductionYear?.toString() ?? "");

  const header = (
    <View style={{ flexDirection: "column" }}>
      <Text className='font-bold text-2xl'>{title}</Text>
      {!!subtitle && <Text className='opacity-70'>{subtitle}</Text>}
    </View>
  );

  // Local state for action sheets
  const [subtitleSheetVisible, setSubtitleSheetVisible] = useState(false);
  const [audioSheetVisible, setAudioSheetVisible] = useState(false);
  // Focus state for buttons to colorize with primary on focus
  const [isRewFocused, setIsRewFocused] = useState(false);
  const [isPlayFocused, setIsPlayFocused] = useState(false);
  const [isFwdFocused, setIsFwdFocused] = useState(false);
  const [isSubsFocused, setIsSubsFocused] = useState(false);
  const [isAudioFocused, setIsAudioFocused] = useState(false);
  const [isSkipFocused, setIsSkipFocused] = useState(false);
  const skipPressedRef = useRef(false);
  // Shared style helper for focus ring behind icons
  const focusCircle = (focused: boolean): any => ({
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: focused ? "rgba(147,51,234,0.22)" : "transparent", // Colors.primary with alpha
  });

  // Ensure controls are visible when Skip Intro becomes available (unless we just pressed it)
  useEffect(() => {
    if (showSkipIntroButton && !showControls && !skipPressedRef.current) {
      setShowControls(true);
    }
  }, [showSkipIntroButton, showControls, setShowControls]);

  // Reset suppression once Skip Intro is no longer available
  useEffect(() => {
    if (!showSkipIntroButton && skipPressedRef.current) {
      skipPressedRef.current = false;
    }
  }, [showSkipIntroButton]);
  const controls = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 24 }}>
      <FocusableItem
        onPress={handleSkipBackward}
        onFocus={() => setIsRewFocused(true)}
        onBlur={() => setIsRewFocused(false)}
      >
        <View style={focusCircle(isRewFocused)}>
          <Ionicons
            name='play-back'
            size={ICON_SIZES.CENTER}
            color={isRewFocused ? Colors.primary : "white"}
          />
        </View>
      </FocusableItem>
      <FocusableItem
        onPress={() => {
          handleControlsInteraction();
          togglePlay();
        }}
        hasTVPreferredFocus={preferPlayFocus && !showSkipIntroButton}
        onFocus={() => setIsPlayFocused(true)}
        onBlur={() => setIsPlayFocused(false)}
      >
        <View style={focusCircle(isPlayFocused)}>
          {!isBuffering ? (
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={ICON_SIZES.CENTER}
              color={isPlayFocused ? Colors.primary : "white"}
            />
          ) : (
            <Loader size={"large"} />
          )}
        </View>
      </FocusableItem>
      <FocusableItem
        onPress={handleSkipForward}
        onFocus={() => setIsFwdFocused(true)}
        onBlur={() => setIsFwdFocused(false)}
      >
        <View style={focusCircle(isFwdFocused)}>
          <Ionicons
            name='play-forward'
            size={ICON_SIZES.CENTER}
            color={isFwdFocused ? Colors.primary : "white"}
          />
        </View>
      </FocusableItem>
      {/* Subtitle selection (to be wired with ModalActionSheet) */}
      <FocusableItem
        onPress={() => {
          handleControlsInteraction();
          setSubtitleSheetVisible(true);
        }}
        onFocus={() => setIsSubsFocused(true)}
        onBlur={() => setIsSubsFocused(false)}
      >
        <View style={focusCircle(isSubsFocused)}>
          <MaterialIcons
            name='subtitles'
            size={ICON_SIZES.CENTER}
            color={isSubsFocused ? Colors.primary : "white"}
          />
        </View>
      </FocusableItem>
      {/* Audio track selection (to be wired with ModalActionSheet) */}
      <FocusableItem
        onPress={() => {
          handleControlsInteraction();
          setAudioSheetVisible(true);
        }}
        onFocus={() => setIsAudioFocused(true)}
        onBlur={() => setIsAudioFocused(false)}
      >
        <View style={focusCircle(isAudioFocused)}>
          <MaterialIcons
            name='audiotrack'
            size={ICON_SIZES.CENTER}
            color={isAudioFocused ? Colors.primary : "white"}
          />
        </View>
      </FocusableItem>
    </View>
  );

  return (
    <ControlProvider
      item={item}
      mediaSource={mediaSource}
      isVideoLoaded={isVideoLoaded}
    >
      <VideoProvider
        getAudioTracks={getAudioTracks}
        getSubtitleTracks={getSubtitleTracks}
        setAudioTrack={setAudioTrack}
        setSubtitleTrack={setSubtitleTrack}
        setSubtitleURL={setSubtitleURL}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              top: 0,
              // Gradient will render as background, keep container transparent
              backgroundColor: "transparent",
            },
            overlayStyle,
          ]}
          pointerEvents={showControls ? "auto" : "none"}
          onTouchStart={handleControlsInteraction}
        >
          {/* Full-screen background gradient: top light gray → bottom darker */}
          <LinearGradient
            pointerEvents='none'
            colors={[
              "rgba(96,95,95,0.0)",
              "rgba(96,95,95,0.10)",
              "rgba(96,95,95,0.6)",
            ]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{
              position: "absolute",
              // Extend slightly beyond edges to avoid any 1px gaps due to rounding/overscan
              top: -(insets.top + 16),
              left: -16,
              right: -16,
              bottom: -(insets.bottom + 16),
            }}
          />
          {/* Bottom-anchored content with safe-area padding */}
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              paddingLeft: insets.left + 24,
              paddingRight: insets.right + 24,
              paddingBottom: insets.bottom + 16,
              paddingTop: insets.top + 16,
            }}
          >
            <Animated.View style={[{ gap: 12 }, mainStyle]}>
              {/* Titles */}
              {!showSkipIntroButton && header}

              {/* Controls or Skip Intro only */}
              <Animated.View style={skipAnimStyle}>
                {/* Always render content; disable focus when hidden */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 24,
                  }}
                >
                  <FocusableItem
                    onPress={() => {
                      onSkipIntro?.();
                      // Hide overlay immediately after skipping intro
                      skipPressedRef.current = true;
                      setShowControls(false);
                    }}
                    hasTVPreferredFocus={true}
                    disabled={!showSkipIntroButton}
                    onFocus={() => setIsSkipFocused(true)}
                    onBlur={() => setIsSkipFocused(false)}
                  >
                    <View
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 999,
                        backgroundColor: isSkipFocused
                          ? Colors.primary
                          : "rgba(255,255,255,0.15)",
                      }}
                    >
                      <Text
                        className='font-bold'
                        style={{ color: isSkipFocused ? "black" : "white" }}
                      >
                        {t("player.skip_intro", "Skip Intro")}
                      </Text>
                    </View>
                  </FocusableItem>
                </View>
              </Animated.View>

              {!showSkipIntroButton && !showNextOverlay && controls}

              {/* Progress bar (hidden when Skip Intro is shown) */}
              {!showSkipIntroButton && !showNextOverlay && (
                <View style={{ marginTop: 8 }}>
                  <TVSlider
                    progress={progress}
                    minimumValue={min}
                    maximumValue={max}
                    cache={cacheProgress}
                    segments={sliderSegments}
                    onSlidingStart={() => {
                      if (__DEV__) console.log("TVSlider start");
                      handleSliderStart();
                      handleControlsInteraction();
                    }}
                    onValueChange={(v) => {
                      if (__DEV__) console.log("TVSlider change", v);
                      handleSliderChange(v);
                    }}
                    onSlidingComplete={(v) => {
                      if (__DEV__) console.log("TVSlider complete", v);
                      handleSliderComplete(v);
                      handleControlsInteraction();
                    }}
                    renderBubble={() => (
                      <TrickplayBubble
                        trickPlayUrl={trickPlayUrl}
                        trickplayInfo={trickplayInfo}
                        time={time}
                      />
                    )}
                    showFocusDot
                    onKeyDown={(e) => {
                      const key = e?.key || e?.nativeEvent?.key;
                      if (key === "ArrowDown" || key === "down") {
                        setEpisodesOpen(true);
                      }
                      if (key === "ArrowUp" || key === "up") {
                        setEpisodesOpen(false);
                      }
                    }}
                  />
                  {/* Time display under slider */}
                  <TimeDisplay
                    currentTime={currentTime}
                    remainingTime={remainingTime}
                    isVlc={!!isVlc}
                  />
                </View>
              )}
            </Animated.View>

            {/* Episode list appears when navigating down (ArrowDown handled by Slider onKeyDown or focus chain) */}
            {/* TODO: make it work :D  */}
            {episodesOpen && (
              <View style={{ marginTop: 12 }}>
                <EpisodeList
                  item={item}
                  close={() => setEpisodesOpen(false)}
                  goToItem={() => {}}
                  horizontalLayout
                  embedded
                />
              </View>
            )}
          </View>
          {/* Subtitle Action Sheet */}
          <SubtitleActionSheet
            visible={subtitleSheetVisible}
            onClose={() => setSubtitleSheetVisible(false)}
          />
          <AudioActionSheet
            visible={audioSheetVisible}
            onClose={() => setAudioSheetVisible(false)}
          />
        </Animated.View>
        {/* Bottom-right Next Episode overlay (TV) */}
        {showNextOverlay && nextItem && (
          <View
            style={{
              position: "absolute",
              right: insets.right + 24,
              bottom: insets.bottom + 24,
              width: 200,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: "rgba(0,0,0,0.6)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
            }}
            pointerEvents={"auto"}
          >
            {/* Preview image */}
            {nextPreviewUrl && (
              <Image
                source={{ uri: nextPreviewUrl }}
                style={{ width: "100%", height: 120 }}
                contentFit='cover'
              />
            )}
            {/* Info and actions */}
            <View style={{ padding: 12, gap: 8 }}>
              <Text className='font-bold'>
                {t("player.next_episode", "Next Episode")}
              </Text>
              <Text className='opacity-70'>
                {nextItem.SeriesName
                  ? `${nextItem.SeriesName} — ${nextItem.Name}`
                  : nextItem.Name}
              </Text>
              <Text className='opacity-70'>
                {t("player.starting_in", "Starting in {{n}}s", {
                  n: secondsLeft,
                })}
              </Text>

              <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                <FocusableItem
                  onPress={playNextNow}
                  hasTVPreferredFocus={showNextOverlay}
                >
                  <View
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: Colors.primary,
                    }}
                  >
                    <Text style={{ color: "#000" }} className='font-bold'>
                      {t("player.play_now", "Play now")}
                    </Text>
                  </View>
                </FocusableItem>
                <FocusableItem onPress={cancelAutoSkip}>
                  <View
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.15)",
                    }}
                  >
                    <Text className='font-bold'>
                      {t("player.cancel", "Cancel")}
                    </Text>
                  </View>
                </FocusableItem>
              </View>
            </View>
          </View>
        )}
      </VideoProvider>
    </ControlProvider>
  );
};

export default TVControls;
