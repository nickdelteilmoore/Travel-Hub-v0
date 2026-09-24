import { Pressable } from "react-native";

import { useTheme } from "@/theme/useTheme";
import type { ColorTokens } from "@/theme/tokens";
import { Text } from "./Text";

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tint?: keyof ColorTokens;
};

/** Single-select filter / category pill. */
export function Chip({ label, selected, onPress, tint = "sage" }: ChipProps) {
  const { colors, radii, spacing, scheme } = useTheme();
  const tintColor = colors[tint];
  const fillOpacity = scheme === "dark" ? "38" : "24"; // hex alpha suffix

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radii.full,
        minHeight: 36,
        justifyContent: "center",
        backgroundColor: selected ? `${tintColor}${fillOpacity}` : colors.surfaceAlt,
        borderWidth: 1,
        borderColor: selected ? tintColor : colors.border,
      }}
    >
      <Text
        variant="caption"
        style={{ color: selected ? tintColor : colors.textMuted }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
