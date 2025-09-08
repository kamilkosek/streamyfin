import * as Application from "expo-application";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { Platform, View, type ViewProps } from "react-native";
import { apiAtom, useJellyfin, userAtom } from "@/providers/JellyfinProvider";
import { Button } from "../Button";
import { FocusableItem } from "../common/FocusableItem";
import { ListGroup } from "../list/ListGroup";
import { ListItem } from "../list/ListItem";

interface Props extends ViewProps {}

export const UserInfo: React.FC<Props> = ({ ...props }) => {
  const [api] = useAtom(apiAtom);
  const [user] = useAtom(userAtom);
  const { t } = useTranslation();
  const { logout } = useJellyfin();

  const version =
    Application?.nativeApplicationVersion ||
    Application?.nativeBuildVersion ||
    "N/A";

  return (
    <View {...props}>
      <ListGroup title={t("home.settings.user_info.user_info_title")}>
        <ListItem
          title={t("home.settings.user_info.user")}
          value={user?.Name}
        />
        {Platform.isTV && (
          <FocusableItem
            onPress={() => {
              logout();
            }}
            disableFocusAnimation={true}
            borderOnFocus={true}
          >
            <Button color='red' onPress={logout}>
              {t("home.settings.log_out_button")}
            </Button>
          </FocusableItem>
        )}
        <ListItem
          title={t("home.settings.user_info.server")}
          value={api?.basePath}
        />
        <ListItem
          title={t("home.settings.user_info.token")}
          value={api?.accessToken}
        />
        <ListItem
          title={t("home.settings.user_info.app_version")}
          value={version}
        />
      </ListGroup>
    </View>
  );
};
