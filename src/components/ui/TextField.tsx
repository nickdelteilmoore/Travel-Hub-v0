import { forwardRef } from "react";
import {
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { useTheme } from "@/theme/useTheme";
import { Text } from "./Text";

export type TextFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(
  function TextField({ label, hint, style, ...rest }, ref) {
    const { colors, radii, spacing, typography } = useTheme();
    return (
      <View style={{ gap: spacing.xs }}>
        {label ? (
          <Text variant="caption" color="textMuted">
            {label}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          style={[
            {
              backgroundColor: colors.surfaceAlt,
              borderRadius: radii.sm,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.md,
              minHeight: 48,
              color: colors.text,
              fontFamily: typography.body.fontFamily,
              fontSize: typography.body.fontSize,
            },
            style,
          ]}
          {...rest}
        />
        {hint ? (
          <Text variant="caption" color="textMuted">
            {hint}
          </Text>
        ) : null}
      </View>
    );
  },
);
