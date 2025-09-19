import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Platform, TouchableOpacity, View, type ViewProps } from "react-native";
import { useActionSheet } from "@/components/actionsheet";
import { Text } from "@/components/common/Text";
import { FilterSheet } from "./FilterSheet";

interface FilterButtonProps<T> extends ViewProps {
  id: string;
  disableSearch?: boolean;
  queryKey: string;
  values: T[];
  title: string;
  set: (value: T[]) => void;
  queryFn: (params: any) => Promise<any>;
  searchFilter?: (item: T, query: string) => boolean;
  renderItemLabel: (item: T) => React.ReactNode;
  multiple?: boolean;
  icon?: "filter" | "sort";
}

export const FilterButton = <T,>({
  id,
  queryFn,
  queryKey,
  set,
  values, // selected values
  title,
  renderItemLabel,
  searchFilter,
  disableSearch = false,
  multiple = false,
  icon = "filter",
  ...props
}: FilterButtonProps<T>) => {
  const [open, setOpen] = useState(false);
  const { showActionSheet } = useActionSheet();

  const { data: filters } = useQuery<T[]>({
    queryKey: ["filters", title, queryKey, id],
    queryFn,
    staleTime: 0,
    enabled: !!id && !!queryFn && !!queryKey,
  });

  // Build ActionSheet options for TV
  const tvOptions = useMemo(() => {
    if (!filters || filters.length === 0) return [];
    return filters.map((item) => ({
      title: String(renderItemLabel(item) as any),
      onPress: () => {
        if (multiple) {
          // Toggle selection; sheet will close, user can reopen to add more
          const exists = values.some((v) => (v as any) === (item as any));
          if (exists) {
            set(values.filter((v) => (v as any) !== (item as any)));
          } else {
            set([...values, item]);
          }
        } else {
          set([item]);
        }
      },
    }));
  }, [filters, renderItemLabel, multiple, values, set]);

  const handlePress = () => {
    if (Platform.isTV) {
      if (!filters || filters.length === 0) return;
      showActionSheet({
        title,
        options: tvOptions,
      });
      return;
    }
    // Mobile: open BottomSheet filter
    if (filters?.length) setOpen(true);
  };

  return (
    <>
      <TouchableOpacity onPress={handlePress}>
        <View
          className={`
            px-3 py-1.5 rounded-full flex flex-row items-center space-x-1
            ${
              values.length > 0
                ? "bg-purple-600  border border-purple-700"
                : "bg-neutral-900 border border-neutral-900"
            }
          ${filters?.length === 0 && "opacity-50"}
            `}
          {...props}
        >
          <Text
            className={`
            ${values.length > 0 ? "text-purple-100" : "text-neutral-100"}
            text-xs font-semibold`}
          >
            {title}
          </Text>
          {icon === "filter" ? (
            <Ionicons
              name='filter'
              size={14}
              color='white'
              style={{ opacity: 0.5 }}
            />
          ) : (
            <FontAwesome
              name='sort'
              size={14}
              color='white'
              style={{ opacity: 0.5 }}
            />
          )}
        </View>
      </TouchableOpacity>
      {!Platform.isTV && (
        <FilterSheet<T>
          title={title}
          open={open}
          setOpen={setOpen}
          data={filters}
          values={values}
          set={set}
          renderItemLabel={renderItemLabel}
          searchFilter={searchFilter}
          disableSearch={disableSearch}
          multiple={multiple}
        />
      )}
    </>
  );
};
