import { View } from "react-native";
import { Leaf } from "lucide-react-native";

import { useTheme } from "@/theme/useTheme";
import { Text } from "./Text";

export type EmptyStateProps = {
  title: string;
  subtitle?: string;
};

export function EmptyState({ title, subtitle }: EmptyStateProps) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing["2xl"],
        gap: spacing.md,
      }}
    >
      <Leaf size={48} color={colors.sage} strokeWidth={1.5} />
      <Text variant="heading" style={{ textAlign: "center" }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" color="textMuted" style={{ textAlign: "center" }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
