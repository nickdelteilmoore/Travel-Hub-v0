import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";

import { Sheet, TextField, Text } from "@/components/ui";
import { useTheme } from "@/theme/useTheme";
import { useCountries, type Country } from "../queries";

export function CountryPicker({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (country: Country) => void;
}) {
  const { colors, spacing } = useTheme();
  const { data: countries } = useCountries();
  const [search, setSearch] = useState("");

  const filtered = (countries ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Choose country">
      <TextField placeholder="Search countries" value={search} onChangeText={setSearch} autoCapitalize="none" />
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.code}
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 360 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              onSelect(item);
              setSearch("");
              onClose();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingVertical: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text variant="title">{item.flag_emoji}</Text>
            <Text variant="body" style={{ flex: 1 }}>{item.name}</Text>
            {item.is_schengen ? <Text variant="caption" color="textMuted">🇪🇺</Text> : null}
          </Pressable>
        )}
      />
    </Sheet>
  );
}
