import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as TaskManager from "expo-task-manager";
import { TFunction } from "i18next";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Linking,
  Platform,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { toast } from "sonner-native";
import { BITRATES } from "@/components/BitrateSelector";
import Dropdown from "@/components/common/Dropdown";
import DisabledSetting from "@/components/settings/DisabledSetting";
import * as ScreenOrientation from "@/packages/expo-screen-orientation";
import { useSettings } from "@/utils/atoms/settings";
import {
  BACKGROUND_FETCH_TASK,
  registerBackgroundFetchAsync,
  unregisterBackgroundFetchAsync,
} from "@/utils/background-tasks";
import { ModalActionSheet } from "../actionsheet/ModalActionSheet";
import { FocusableItem } from "../common/FocusableItem";
import { Text } from "../common/Text";
import { ListGroup } from "../list/ListGroup";
import { ListItem } from "../list/ListItem";

export const OtherSettings: React.FC = () => {
  const router = useRouter();
  const { settings, updateSettings, pluginSettings } = useSettings();

  const { t } = useTranslation();
  const isTv = Platform.isTV;

  // TV modal visibility states
  const [orientationSheetVisible, setOrientationSheetVisible] = useState(false);
  const [qualitySheetVisible, setQualitySheetVisible] = useState(false);
  const [autoplaySheetVisible, setAutoplaySheetVisible] = useState(false);

  /********************
   * Background task
   *******************/
  const checkStatusAsync = async () => {
    if (Platform.isTV) return false;
    return TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
  };

  useEffect(() => {
    (async () => {
      const registered = await checkStatusAsync();

      if (settings?.autoDownload === true && !registered) {
        registerBackgroundFetchAsync();
        toast.success("Background downloads enabled");
      } else if (settings?.autoDownload === false && registered) {
        unregisterBackgroundFetchAsync();
        toast.info("Background downloads disabled");
      } else if (settings?.autoDownload === true && registered) {
        // Don't to anything
      } else if (settings?.autoDownload === false && !registered) {
        // Don't to anything
      } else {
        updateSettings({ autoDownload: false });
      }
    })();
  }, [settings?.autoDownload]);
  /**********************
   *********************/

  const disabled = useMemo(
    () =>
      pluginSettings?.followDeviceOrientation?.locked === true &&
      pluginSettings?.defaultVideoOrientation?.locked === true &&
      pluginSettings?.safeAreaInControlsEnabled?.locked === true &&
      pluginSettings?.showCustomMenuLinks?.locked === true &&
      pluginSettings?.hiddenLibraries?.locked === true &&
      pluginSettings?.disableHapticFeedback?.locked === true,
    [pluginSettings],
  );

  const orientations = [
    ScreenOrientation.OrientationLock.DEFAULT,
    ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ScreenOrientation.OrientationLock.LANDSCAPE_LEFT,
    ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
  ];

  const orientationTranslations = useMemo(
    () => ({
      [ScreenOrientation.OrientationLock.DEFAULT]:
        "home.settings.other.orientations.DEFAULT",
      [ScreenOrientation.OrientationLock.PORTRAIT_UP]:
        "home.settings.other.orientations.PORTRAIT_UP",
      [ScreenOrientation.OrientationLock.LANDSCAPE_LEFT]:
        "home.settings.other.orientations.LANDSCAPE_LEFT",
      [ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT]:
        "home.settings.other.orientations.LANDSCAPE_RIGHT",
    }),
    [],
  );

  // TV ActionSheet options
  const orientationOptions = useMemo(() => {
    const disabled =
      pluginSettings?.defaultVideoOrientation?.locked ||
      settings?.followDeviceOrientation;
    return orientations.map((o) => ({
      title: t(
        orientationTranslations[o as keyof typeof orientationTranslations] ||
          "home.settings.other.orientations.DEFAULT",
      ),
      icon:
        settings?.defaultVideoOrientation === o ? (
          <Ionicons name='checkmark' size={18} color='#ffffff' />
        ) : undefined,
      onPress: () => {
        if (!disabled) updateSettings({ defaultVideoOrientation: o });
        setOrientationSheetVisible(false);
      },
      disabled,
    }));
  }, [
    orientations,
    settings?.defaultVideoOrientation,
    settings?.followDeviceOrientation,
    pluginSettings?.defaultVideoOrientation?.locked,
    t,
    orientationTranslations,
    updateSettings,
  ]);

  const bitrateOptions = useMemo(() => {
    const disabled = pluginSettings?.defaultBitrate?.locked;
    return BITRATES.map((b) => ({
      title: b.key ?? "Unknown",
      icon:
        settings?.defaultBitrate?.key === b.key ? (
          <Ionicons name='checkmark' size={18} color='#ffffff' />
        ) : undefined,
      onPress: () => {
        if (!disabled) updateSettings({ defaultBitrate: b });
        setQualitySheetVisible(false);
      },
      disabled,
    }));
  }, [
    pluginSettings?.defaultBitrate?.locked,
    settings?.defaultBitrate?.key,
    updateSettings,
  ]);

  const autoplayItems = useMemo(() => AUTOPLAY_EPISODES_COUNT(t), [t]);
  const autoplayOptions = useMemo(() => {
    return autoplayItems.map((it) => ({
      title: it.key ?? "Unknown",
      icon:
        settings?.maxAutoPlayEpisodeCount?.value === it.value ? (
          <Ionicons name='checkmark' size={18} color='#ffffff' />
        ) : undefined,
      onPress: () => {
        updateSettings({ maxAutoPlayEpisodeCount: it });
        setAutoplaySheetVisible(false);
      },
    }));
  }, [autoplayItems, settings?.maxAutoPlayEpisodeCount?.value, updateSettings]);

  if (!settings) return null;

  return (
    <DisabledSetting disabled={disabled}>
      <ListGroup title={t("home.settings.other.other_title")} className=''>
        {!Platform.isTV && (
          <ListItem
            title={t("home.settings.other.follow_device_orientation")}
            disabled={pluginSettings?.followDeviceOrientation?.locked}
          >
            <Switch
              value={settings.followDeviceOrientation}
              disabled={pluginSettings?.followDeviceOrientation?.locked}
              onValueChange={(value) =>
                updateSettings({ followDeviceOrientation: value })
              }
            />
          </ListItem>
        )}
        {Platform.isTV && (
          <ListItem
            title={t("home.settings.other.video_orientation")}
            disabled={
              pluginSettings?.defaultVideoOrientation?.locked ||
              settings.followDeviceOrientation
            }
          >
            {/* TV: Use ModalActionSheet instead of Dropdown */}
            <FocusableItem
              onPress={() => {
                if (
                  !(
                    pluginSettings?.defaultVideoOrientation?.locked ||
                    settings.followDeviceOrientation
                  )
                ) {
                  setOrientationSheetVisible(true);
                }
              }}
              disabled={
                pluginSettings?.defaultVideoOrientation?.locked ||
                settings.followDeviceOrientation
              }
            >
              <View className='flex flex-row items-center justify-between py-3 pl-3'>
                <Text className='mr-1 text-[#8E8D91]'>
                  {t(
                    orientationTranslations[
                      settings.defaultVideoOrientation as keyof typeof orientationTranslations
                    ],
                  ) || "Unknown Orientation"}
                </Text>
                <Ionicons
                  name='chevron-expand-sharp'
                  size={18}
                  color='#5A5960'
                />
              </View>
            </FocusableItem>
            <ModalActionSheet
              title={t("home.settings.other.orientation")}
              options={orientationOptions}
              visible={orientationSheetVisible}
              onCancel={() => setOrientationSheetVisible(false)}
              onDismiss={() => setOrientationSheetVisible(false)}
            />
          </ListItem>
        )}
        {!Platform.isTV && (
          <ListItem
            title={t("home.settings.other.safe_area_in_controls")}
            disabled={pluginSettings?.safeAreaInControlsEnabled?.locked}
          >
            <Switch
              value={settings.safeAreaInControlsEnabled}
              disabled={pluginSettings?.safeAreaInControlsEnabled?.locked}
              onValueChange={(value) =>
                updateSettings({ safeAreaInControlsEnabled: value })
              }
            />
          </ListItem>
        )}

        {/* {(Platform.OS === "ios" || Platform.isTVOS)&& (
          <ListItem
            title={t("home.settings.other.video_player")}
            disabled={pluginSettings?.defaultPlayer?.locked}
          >
            <Dropdown
              data={Object.values(VideoPlayer).filter(isNumber)}
              disabled={pluginSettings?.defaultPlayer?.locked}
              keyExtractor={String}
              titleExtractor={(item) => t(`home.settings.other.video_players.${VideoPlayer[item]}`)}
              title={
                <TouchableOpacity className="flex flex-row items-center justify-between py-3 pl-3">
                  <Text className="mr-1 text-[#8E8D91]">
                    {t(`home.settings.other.video_players.${VideoPlayer[settings.defaultPlayer]}`)}
                  </Text>
                  <Ionicons
                    name="chevron-expand-sharp"
                    size={18}
                    color="#5A5960"
                  />
                </TouchableOpacity>
              }
              label={t("home.settings.other.orientation")}
              onSelected={(defaultPlayer) =>
                updateSettings({ defaultPlayer })
              }
            />
          </ListItem>
        )} */}

        <ListItem
          title={t("home.settings.other.show_custom_menu_links")}
          disabled={pluginSettings?.showCustomMenuLinks?.locked}
          onPress={() =>
            Linking.openURL(
              "https://jellyfin.org/docs/general/clients/web-config/#custom-menu-links",
            )
          }
        >
          <FocusableItem
            onPress={
              Platform.isTV
                ? () =>
                    !pluginSettings?.showCustomMenuLinks?.locked &&
                    updateSettings({
                      showCustomMenuLinks: !settings.showCustomMenuLinks,
                    })
                : undefined
            }
            disabled={pluginSettings?.showCustomMenuLinks?.locked}
            borderOnFocus={true}
          >
            <Switch
              value={settings.showCustomMenuLinks}
              disabled={pluginSettings?.showCustomMenuLinks?.locked}
              onValueChange={(value) =>
                updateSettings({ showCustomMenuLinks: value })
              }
            />
          </FocusableItem>
        </ListItem>
        <ListItem
          onPress={() => router.push("/settings/hide-libraries/page")}
          title={t("home.settings.other.hide_libraries")}
          showArrow
        />
        <ListItem
          title={t("home.settings.other.default_quality")}
          disabled={pluginSettings?.defaultBitrate?.locked}
        >
          {isTv ? (
            <>
              <FocusableItem
                onPress={() => {
                  if (!pluginSettings?.defaultBitrate?.locked) {
                    setQualitySheetVisible(true);
                  }
                }}
                disabled={pluginSettings?.defaultBitrate?.locked}
              >
                <View className='flex flex-row items-center justify-between py-3 pl-3'>
                  <Text className='mr-1 text-[#8E8D91]'>
                    {settings.defaultBitrate?.key}
                  </Text>
                  <Ionicons
                    name='chevron-expand-sharp'
                    size={18}
                    color='#5A5960'
                  />
                </View>
              </FocusableItem>
              <ModalActionSheet
                title={t("home.settings.other.default_quality")}
                options={bitrateOptions}
                visible={qualitySheetVisible}
                onCancel={() => setQualitySheetVisible(false)}
                onDismiss={() => setQualitySheetVisible(false)}
              />
            </>
          ) : (
            <Dropdown
              data={BITRATES}
              disabled={pluginSettings?.defaultBitrate?.locked}
              keyExtractor={(item) => item.key}
              titleExtractor={(item) => item.key}
              title={
                <TouchableOpacity className='flex flex-row items-center justify-between py-3 pl-3'>
                  <Text className='mr-1 text-[#8E8D91]'>
                    {settings.defaultBitrate?.key}
                  </Text>
                  <Ionicons
                    name='chevron-expand-sharp'
                    size={18}
                    color='#5A5960'
                  />
                </TouchableOpacity>
              }
              label={t("home.settings.other.default_quality")}
              onSelected={(defaultBitrate) =>
                updateSettings({ defaultBitrate })
              }
            />
          )}
        </ListItem>
        <ListItem
          title={t("home.settings.other.disable_haptic_feedback")}
          disabled={pluginSettings?.disableHapticFeedback?.locked}
        >
          <FocusableItem
            onPress={
              Platform.isTV
                ? () =>
                    !pluginSettings?.disableHapticFeedback?.locked &&
                    updateSettings({
                      disableHapticFeedback: !settings.disableHapticFeedback,
                    })
                : undefined
            }
            disabled={pluginSettings?.disableHapticFeedback?.locked}
            borderOnFocus={true}
          >
            <Switch
              value={settings.disableHapticFeedback}
              disabled={pluginSettings?.disableHapticFeedback?.locked}
              onValueChange={(disableHapticFeedback) =>
                updateSettings({ disableHapticFeedback })
              }
            />
          </FocusableItem>
        </ListItem>
        <ListItem title={t("home.settings.other.max_auto_play_episode_count")}>
          {isTv ? (
            <>
              <FocusableItem onPress={() => setAutoplaySheetVisible(true)}>
                <View className='flex flex-row items-center justify-between py-3 pl-3'>
                  <Text className='mr-1 text-[#8E8D91]'>
                    {t(settings?.maxAutoPlayEpisodeCount.key)}
                  </Text>
                  <Ionicons
                    name='chevron-expand-sharp'
                    size={18}
                    color='#5A5960'
                  />
                </View>
              </FocusableItem>
              <ModalActionSheet
                title={t("home.settings.other.max_auto_play_episode_count")}
                options={autoplayOptions}
                visible={autoplaySheetVisible}
                onCancel={() => setAutoplaySheetVisible(false)}
                onDismiss={() => setAutoplaySheetVisible(false)}
              />
            </>
          ) : (
            <Dropdown
              data={AUTOPLAY_EPISODES_COUNT(t)}
              keyExtractor={(item) => item.key}
              titleExtractor={(item) => item.key}
              title={
                <TouchableOpacity className='flex flex-row items-center justify-between py-3 pl-3'>
                  <Text className='mr-1 text-[#8E8D91]'>
                    {t(settings?.maxAutoPlayEpisodeCount.key)}
                  </Text>
                  <Ionicons
                    name='chevron-expand-sharp'
                    size={18}
                    color='#5A5960'
                  />
                </TouchableOpacity>
              }
              label={t("home.settings.other.max_auto_play_episode_count")}
              onSelected={(maxAutoPlayEpisodeCount) =>
                updateSettings({ maxAutoPlayEpisodeCount })
              }
            />
          )}
        </ListItem>
      </ListGroup>
    </DisabledSetting>
  );
};

const AUTOPLAY_EPISODES_COUNT = (
  t: TFunction<"translation", undefined>,
): {
  key: string;
  value: number;
}[] => [
  { key: t("home.settings.other.disabled"), value: -1 },
  { key: "1", value: 1 },
  { key: "2", value: 2 },
  { key: "3", value: 3 },
  { key: "4", value: 4 },
  { key: "5", value: 5 },
  { key: "6", value: 6 },
  { key: "7", value: 7 },
];
