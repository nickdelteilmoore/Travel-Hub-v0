import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { useTheme } from "@/theme/useTheme";
import type { ColorTokens, TypographyVariant } from "@/theme/tokens";

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: keyof ColorTokens;
};

/** Token-driven text. Never set fontFamily/fontSize by hand. */
export function Text({
  variant = "body",
  color = "text",
  style,
  ...rest
}: TextProps) {
  const { typography, colors } = useTheme();
  const t = typography[variant];
  return (
    <RNText
      style={[
        {
          fontFamily: t.fontFamily,
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          letterSpacing: t.letterSpacing,
          textTransform: t.textTransform,
          fontVariant: t.fontVariant,
          color: colors[color],
        },
        style,
      ]}
      {...rest}
    />
  );
}
