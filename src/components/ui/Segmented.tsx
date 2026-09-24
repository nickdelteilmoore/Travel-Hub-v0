import { Pressable, View } from "react-native";

import { useTheme } from "@/theme/useTheme";
import { Text } from "./Text";

export type SegmentedOption<T extends string> = { label: string; value: T };

export type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Two-way segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surfaceAlt,
        borderRadius: radii.full,
        padding: spacing.xs,
        gap: spacing.xs,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={{
              flex: 1,
              minHeight: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.full,
              backgroundColor: active ? colors.surface : "transparent",
              borderWidth: active ? 1 : 0,
              borderColor: colors.border,
            }}
          >
            <Text variant="bodyMedium" color={active ? "text" : "textMuted"}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
