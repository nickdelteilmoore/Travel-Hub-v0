import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "./Text";

export type CircularFlagBadgeProps = {
  /** Flag emoji (e.g. "🇫🇷"); alternatively pass `children` for an SVG glyph. */
  flag?: string;
  children?: ReactNode;
  size?: number;
};

/**
 * country-flag container: a 36×36 pure-white circle in both light and
 * dark mode. The #FFFFFF fill is spec-mandated (DESIGN.md) — the one place
 * a literal colour is intentional rather than a token.
 */
export function CircularFlagBadge({
  flag,
  children,
  size = 36,
}: CircularFlagBadgeProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {children ?? (
        <Text style={{ fontSize: size * 0.55, lineHeight: size * 0.7 }}>
          {flag}
        </Text>
      )}
    </View>
  );
}
