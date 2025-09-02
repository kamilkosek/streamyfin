import type {
  BaseItemDto,
  BaseItemPerson,
} from "@jellyfin/sdk/lib/generated-client/models";
import { router, useSegments } from "expo-router";
import { useAtom } from "jotai";
import type React from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Platform, View, type ViewProps } from "react-native";
import { apiAtom } from "@/providers/JellyfinProvider";
import { getPrimaryImageUrl } from "@/utils/jellyfin/image/getPrimaryImageUrl";
import { FocusableItem } from "../common/FocusableItem";
import { HorizontalScroll } from "../common/HorrizontalScroll";
import { Text } from "../common/Text";
import { itemRouter } from "../common/TouchableItemRouter";
import Poster from "../posters/Poster";

interface Props extends ViewProps {
  item?: BaseItemDto | null;
  loading?: boolean;
}

// Cast member item component with TV elevation effect
const CastMemberItem: React.FC<{
  person: BaseItemPerson;
  onPress: () => void;
}> = ({ person, onPress }) => {
  const [api] = useAtom(apiAtom);

  return (
    <FocusableItem onPress={onPress} className='flex flex-col w-28'>
      <Poster id={person.Id} url={getPrimaryImageUrl({ api, item: person })} />
      <Text className='mt-2'>{person.Name}</Text>
      <Text className='text-xs opacity-50'>{person.Role}</Text>
    </FocusableItem>
  );
};

export const CastAndCrew: React.FC<Props> = ({ item, loading, ...props }) => {
  const segments = useSegments();
  const { t } = useTranslation();
  const from = segments[2];

  const destinctPeople = useMemo(() => {
    const people: BaseItemPerson[] = [];
    item?.People?.forEach((person) => {
      const existingPerson = people.find((p) => p.Id === person.Id);
      if (existingPerson) {
        existingPerson.Role = `${existingPerson.Role}, ${person.Role}`;
      } else {
        people.push(person);
      }
    });
    return people;
  }, [item?.People]);

  if (!from) return null;

  return (
    <View
      {...props}
      className='flex flex-col'
      style={Platform.isTV ? { overflow: "visible" } : undefined}
    >
      <Text className='text-lg font-bold mb-2 px-4'>
        {t("item_card.cast_and_crew")}
      </Text>
      <HorizontalScroll
        loading={loading}
        keyExtractor={(i, _idx) => i.Id?.toString() || `cast-${_idx}`}
        height={247}
        data={destinctPeople}
        renderItem={(i) => (
          <CastMemberItem
            person={i}
            onPress={() => {
              const url = itemRouter(i, from);
              // @ts-expect-error
              router.push(url);
            }}
          />
        )}
        containerStyle={Platform.isTV ? { overflow: "visible" } : undefined}
        contentContainerStyle={
          Platform.isTV ? { overflow: "visible" } : undefined
        }
      />
    </View>
  );
};
