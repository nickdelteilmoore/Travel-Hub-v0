import { View, type ViewProps, type ViewStyle } from "react-native";

import { useTheme } from "@/theme/useTheme";

export type CardProps = ViewProps & {
  padded?: boolean;
  style?: ViewStyle;
};

/** Flat surface card with a hairline border. */
export function Card({ padded = true, style, children, ...rest }: CardProps) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
