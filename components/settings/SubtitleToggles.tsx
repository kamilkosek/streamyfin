import { useMemo, useState } from "react";
import { Platform, TouchableOpacity, View, type ViewProps } from "react-native";

const _DropdownMenu = !Platform.isTV ? require("zeego/dropdown-menu") : null;

import { Ionicons } from "@expo/vector-icons";
import { SubtitlePlaybackMode } from "@jellyfin/sdk/lib/generated-client";
import { useTranslation } from "react-i18next";
import { Switch } from "react-native-gesture-handler";
import Dropdown from "@/components/common/Dropdown";
import { Stepper } from "@/components/inputs/Stepper";
import { useSettings } from "@/utils/atoms/settings";
import { ModalActionSheet } from "../actionsheet/ModalActionSheet";
import { FocusableItem } from "../common/FocusableItem";
import { Text } from "../common/Text";
import { ListGroup } from "../list/ListGroup";
import { ListItem } from "../list/ListItem";
import { useMedia } from "./MediaContext";

interface Props extends ViewProps {}

export const SubtitleToggles: React.FC<Props> = ({ ...props }) => {
  const isTv = Platform.isTV;

  const media = useMedia();
  const [_, __, pluginSettings] = useSettings(null);
  const { settings, updateSettings } = media;
  const cultures = media.cultures;
  const { t } = useTranslation();

  // Local state for TV action sheets
  const [langSheetVisible, setLangSheetVisible] = useState(false);
  const [modeSheetVisible, setModeSheetVisible] = useState(false);

  //if (isTv) return null;

  const subtitleModes = [
    SubtitlePlaybackMode.Default,
    SubtitlePlaybackMode.Smart,
    SubtitlePlaybackMode.OnlyForced,
    SubtitlePlaybackMode.Always,
    SubtitlePlaybackMode.None,
  ];

  const subtitleModeKeys = {
    [SubtitlePlaybackMode.Default]: "home.settings.subtitles.modes.Default",
    [SubtitlePlaybackMode.Smart]: "home.settings.subtitles.modes.Smart",
    [SubtitlePlaybackMode.OnlyForced]:
      "home.settings.subtitles.modes.OnlyForced",
    [SubtitlePlaybackMode.Always]: "home.settings.subtitles.modes.Always",
    [SubtitlePlaybackMode.None]: "home.settings.subtitles.modes.None",
  };

  // Memoized options for TV action sheets
  const languageItems = useMemo(() => {
    return [
      {
        DisplayName: t("home.settings.subtitles.none"),
        ThreeLetterISOLanguageName: "none-subs",
      },
      ...(cultures ?? []),
    ];
  }, [cultures, t]);

  const languageOptions = useMemo(() => {
    const currentLang = settings?.defaultSubtitleLanguage;
    return languageItems.map((item) => ({
      title: item.DisplayName ?? "Unknown",
      icon:
        (currentLang == null &&
          item.ThreeLetterISOLanguageName === "none-subs") ||
        currentLang?.ThreeLetterISOLanguageName ===
          item.ThreeLetterISOLanguageName ? (
          <Ionicons name='checkmark' size={18} color='#ffffff' />
        ) : undefined,
      onPress: () => {
        updateSettings({
          defaultSubtitleLanguage:
            item.ThreeLetterISOLanguageName === "none-subs"
              ? null
              : (item as any),
        });
        setLangSheetVisible(false);
      },
    }));
  }, [languageItems, settings?.defaultSubtitleLanguage, updateSettings]);

  const subtitleModeOptions = useMemo(() => {
    const current = settings?.subtitleMode;
    return subtitleModes.map((mode) => ({
      title: t(subtitleModeKeys[mode]),
      icon:
        current === mode ? (
          <Ionicons name='checkmark' size={18} color='#ffffff' />
        ) : undefined,
      onPress: () => {
        updateSettings({ subtitleMode: mode });
        setModeSheetVisible(false);
      },
      disabled: pluginSettings?.subtitleMode?.locked,
    }));
  }, [
    subtitleModes,
    settings?.subtitleMode,
    t,
    updateSettings,
    pluginSettings?.subtitleMode?.locked,
  ]);

  // After hooks: return early if settings are not yet available
  if (!settings) return null;

  return (
    <View {...props}>
      <ListGroup
        title={t("home.settings.subtitles.subtitle_title")}
        description={
          <Text className='text-[#8E8D91] text-xs'>
            {t("home.settings.subtitles.subtitle_hint")}
          </Text>
        }
      >
        <ListItem title={t("home.settings.subtitles.subtitle_language")}>
          {isTv ? (
            <>
              <FocusableItem>
                <TouchableOpacity
                  className='flex flex-row items-center justify-between py-3 pl-3'
                  onPress={() => setLangSheetVisible(true)}
                >
                  <Text className='mr-1 text-[#8E8D91]'>
                    {settings?.defaultSubtitleLanguage?.DisplayName ||
                      t("home.settings.subtitles.none")}
                  </Text>
                  <Ionicons
                    name='chevron-expand-sharp'
                    size={18}
                    color='#5A5960'
                  />
                </TouchableOpacity>
              </FocusableItem>
              <ModalActionSheet
                title={t("home.settings.subtitles.language")}
                options={languageOptions}
                visible={langSheetVisible}
                onCancel={() => setLangSheetVisible(false)}
                onDismiss={() => setLangSheetVisible(false)}
              />
            </>
          ) : (
            <Dropdown
              data={[
                {
                  DisplayName: t("home.settings.subtitles.none"),
                  ThreeLetterISOLanguageName: "none-subs",
                },
                ...(cultures ?? []),
              ]}
              keyExtractor={(item) =>
                item?.ThreeLetterISOLanguageName ?? "unknown"
              }
              titleExtractor={(item) => item?.DisplayName}
              title={
                <TouchableOpacity className='flex flex-row items-center justify-between py-3 pl-3'>
                  <Text className='mr-1 text-[#8E8D91]'>
                    {settings?.defaultSubtitleLanguage?.DisplayName ||
                      t("home.settings.subtitles.none")}
                  </Text>
                  <Ionicons
                    name='chevron-expand-sharp'
                    size={18}
                    color='#5A5960'
                  />
                </TouchableOpacity>
              }
              label={t("home.settings.subtitles.language")}
              onSelected={(defaultSubtitleLanguage) =>
                updateSettings({
                  defaultSubtitleLanguage:
                    defaultSubtitleLanguage.DisplayName ===
                    t("home.settings.subtitles.none")
                      ? null
                      : defaultSubtitleLanguage,
                })
              }
            />
          )}
        </ListItem>

        <ListItem
          title={t("home.settings.subtitles.subtitle_mode")}
          disabled={pluginSettings?.subtitleMode?.locked}
        >
          {isTv ? (
            <>
              <FocusableItem>
                <TouchableOpacity
                  className='flex flex-row items-center justify-between py-3 pl-3'
                  onPress={() => {
                    if (!pluginSettings?.subtitleMode?.locked)
                      setModeSheetVisible(true);
                  }}
                  disabled={pluginSettings?.subtitleMode?.locked}
                >
                  <Text className='mr-1 text-[#8E8D91]'>
                    {t(subtitleModeKeys[settings?.subtitleMode]) ||
                      t("home.settings.subtitles.loading")}
                  </Text>
                  <Ionicons
                    name='chevron-expand-sharp'
                    size={18}
                    color='#5A5960'
                  />
                </TouchableOpacity>
              </FocusableItem>
              <ModalActionSheet
                title={t("home.settings.subtitles.subtitle_mode")}
                options={subtitleModeOptions}
                visible={modeSheetVisible}
                onCancel={() => setModeSheetVisible(false)}
                onDismiss={() => setModeSheetVisible(false)}
              />
            </>
          ) : (
            <Dropdown
              data={subtitleModes}
              disabled={pluginSettings?.subtitleMode?.locked}
              keyExtractor={String}
              titleExtractor={(item) =>
                t(subtitleModeKeys[item]) || String(item)
              }
              title={
                <TouchableOpacity className='flex flex-row items-center justify-between py-3 pl-3'>
                  <Text className='mr-1 text-[#8E8D91]'>
                    {t(subtitleModeKeys[settings?.subtitleMode]) ||
                      t("home.settings.subtitles.loading")}
                  </Text>
                  <Ionicons
                    name='chevron-expand-sharp'
                    size={18}
                    color='#5A5960'
                  />
                </TouchableOpacity>
              }
              label={t("home.settings.subtitles.subtitle_mode")}
              onSelected={(subtitleMode) => updateSettings({ subtitleMode })}
            />
          )}
        </ListItem>

        <ListItem
          title={t("home.settings.subtitles.set_subtitle_track")}
          disabled={pluginSettings?.rememberSubtitleSelections?.locked}
        >
          <FocusableItem>
            <Switch
              value={settings.rememberSubtitleSelections}
              disabled={pluginSettings?.rememberSubtitleSelections?.locked}
              onValueChange={(value) =>
                updateSettings({ rememberSubtitleSelections: value })
              }
            />
          </FocusableItem>
        </ListItem>

        <ListItem
          title={t("home.settings.subtitles.subtitle_size")}
          disabled={pluginSettings?.subtitleSize?.locked}
        >
          <FocusableItem>
            <Stepper
              value={settings.subtitleSize}
              disabled={pluginSettings?.subtitleSize?.locked}
              step={5}
              min={0}
              max={120}
              onUpdate={(subtitleSize) => updateSettings({ subtitleSize })}
            />
          </FocusableItem>
        </ListItem>
      </ListGroup>
    </View>
  );
};
