import {
  ActivityIndicator,
  Pressable,
  View,
  type PressableProps,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/theme/useTheme";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  variant = "primary",
  loading = false,
  leftIcon,
  fullWidth,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { colors, radii, spacing } = useTheme();

  const bg: Record<Variant, string> = {
    primary: colors.primary,
    secondary: colors.surfaceAlt,
    ghost: "transparent",
    danger: colors.danger,
  };
  const fg: Record<Variant, keyof typeof colors> = {
    primary: "onPrimary",
    secondary: "text",
    ghost: "primary",
    danger: "onPrimary",
  };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => ({
        opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
        backgroundColor: bg[variant],
        borderRadius: radii.full,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: spacing.sm,
        alignSelf: fullWidth ? "stretch" : "flex-start",
        ...style,
      })}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors[fg[variant]]} />
      ) : (
        <>
          {leftIcon ? <View>{leftIcon}</View> : null}
          <Text variant="bodyMedium" color={fg[variant]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
