import type { ReactNode } from "react";
import {
  Pressable,
  View,
  type PressableProps,
  type ViewStyle,
} from "react-native";

import { useTheme, useMiniAppPalette } from "@/theme/useTheme";
import type { MiniAppId } from "@/theme/tokens";

export type LeafCardProps = {
  children: ReactNode;
  /** Fill the card with a mini-app's surface tint. */
  appId?: MiniAppId;
  /** Explicit surface colour; overrides `appId`. Defaults to neutral surface. */
  surface?: string;
  padded?: boolean;
  onPress?: PressableProps["onPress"];
  onLongPress?: PressableProps["onLongPress"];
  /** Accessibility label when the card is pressable. */
  accessibilityLabel?: string;
  style?: ViewStyle;
};

/**
 * Surface card with the asymmetrical leaf geometry (20/20/20/0). Pressable
 * variants compress to scale(0.98) on touch.
 */
export function LeafCard({
  children,
  appId,
  surface,
  padded = true,
  onPress,
  onLongPress,
  accessibilityLabel,
  style,
}: LeafCardProps) {
  const { colors, leafRadii, spacing } = useTheme();
  const palette = useMiniAppPalette(appId ?? "travel");

  const backgroundColor =
    surface ?? (appId ? palette.surface : colors.surface);
  const showBorder = !surface && !appId;

  const base: ViewStyle = {
    ...leafRadii,
    backgroundColor,
    padding: padded ? spacing.lg : 0,
    borderWidth: showBorder ? 1 : 0,
    borderColor: colors.border,
  };

  if (!onPress && !onLongPress) {
    return <View style={[base, style]}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        base,
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
