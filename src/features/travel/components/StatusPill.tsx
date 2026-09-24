import { View } from "react-native";

import { Text } from "@/components/ui";
import { useTheme, useMiniAppPalette } from "@/theme/useTheme";
import type { SegmentStatus, StatusTone } from "../segments";

/** Resolve a semantic status tone to a theme colour (no hardcoded hexes). */
export function useToneColor(tone: StatusTone): string {
  const { colors } = useTheme();
  const palette = useMiniAppPalette("travel");
  switch (tone) {
    case "ontime":
      return colors.success;
    case "delayed":
      return colors.warning;
    case "alert":
      return colors.danger;
    case "cancelled":
    case "stale":
      return colors.textMuted;
    case "info":
      return palette.accent;
  }
}

/** Small tinted chip carrying a segment's status. */
export function StatusPill({ status }: { status: SegmentStatus }) {
  const { spacing, radii } = useTheme();
  const color = useToneColor(status.tone);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: `${color}22`,
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
      }}
    >
      <Text variant="eyebrow" style={{ color }}>
        {status.label}
      </Text>
    </View>
  );
}
