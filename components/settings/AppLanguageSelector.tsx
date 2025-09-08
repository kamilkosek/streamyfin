const DropdownMenu = !Platform.isTV ? require("zeego/dropdown-menu") : null;

import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, TouchableOpacity, View, type ViewProps } from "react-native";
import { APP_LANGUAGES } from "@/i18n";
import { useSettings } from "@/utils/atoms/settings";
import { ModalActionSheet } from "../actionsheet/ModalActionSheet";
import { Text } from "../common/Text";
import { ListGroup } from "../list/ListGroup";
import { ListItem } from "../list/ListItem";

interface Props extends ViewProps {}

export const AppLanguageSelector: React.FC<Props> = () => {
  const isTv = Platform.isTV;
  const [settings, updateSettings] = useSettings(null);
  const { t } = useTranslation();

  const [sheetVisible, setSheetVisible] = useState(false);

  const currentLabel = useMemo(() => {
    return (
      APP_LANGUAGES.find((l) => l.value === settings?.preferedLanguage)
        ?.label || t("home.settings.languages.system")
    );
  }, [settings?.preferedLanguage, t]);

  const languageOptions = useMemo(() => {
    return [
      {
        title: t("home.settings.languages.system"),
        icon:
          settings?.preferedLanguage == null ? (
            <Ionicons name='checkmark' size={18} color='#ffffff' />
          ) : undefined,
        onPress: () => {
          updateSettings({ preferedLanguage: undefined });
          setSheetVisible(false);
        },
      },
      ...APP_LANGUAGES.map((l) => ({
        title: l.label,
        icon:
          settings?.preferedLanguage === l.value ? (
            <Ionicons name='checkmark' size={18} color='#ffffff' />
          ) : undefined,
        onPress: () => {
          updateSettings({ preferedLanguage: l.value });
          setSheetVisible(false);
        },
      })),
    ];
  }, [settings?.preferedLanguage, updateSettings, t]);

  if (!settings) return null;

  return (
    <View>
      <ListGroup title={t("home.settings.languages.title")}>
        <ListItem title={t("home.settings.languages.app_language")}>
          {isTv ? (
            <>
              <TouchableOpacity
                className='bg-neutral-800 rounded-lg border-neutral-900 border px-3 py-2 flex flex-row items-center justify-between'
                onPress={() => setSheetVisible(true)}
              >
                <Text>{currentLabel}</Text>
                <Ionicons
                  name='chevron-expand-sharp'
                  size={18}
                  color='#5A5960'
                />
              </TouchableOpacity>
              <ModalActionSheet
                title={t("home.settings.languages.title")}
                options={languageOptions}
                visible={sheetVisible}
                onCancel={() => setSheetVisible(false)}
                onDismiss={() => setSheetVisible(false)}
              />
            </>
          ) : (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <TouchableOpacity className='bg-neutral-800 rounded-lg border-neutral-900 border px-3 py-2 flex flex-row items-center justify-between'>
                  <Text>{currentLabel}</Text>
                </TouchableOpacity>
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
                <DropdownMenu.Label>
                  {t("home.settings.languages.title")}
                </DropdownMenu.Label>
                <DropdownMenu.Item
                  key={"unknown"}
                  onSelect={() => {
                    updateSettings({ preferedLanguage: undefined });
                  }}
                >
                  <DropdownMenu.ItemTitle>
                    {t("home.settings.languages.system")}
                  </DropdownMenu.ItemTitle>
                </DropdownMenu.Item>
                {APP_LANGUAGES?.map((l) => (
                  <DropdownMenu.Item
                    key={l?.value ?? "unknown"}
                    onSelect={() => {
                      updateSettings({ preferedLanguage: l.value });
                    }}
                  >
                    <DropdownMenu.ItemTitle>{l.label}</DropdownMenu.ItemTitle>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          )}
        </ListItem>
      </ListGroup>
    </View>
  );
};
