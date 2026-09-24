import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useTheme } from "@/theme/useTheme";

export type ScreenProps = {
  children: ReactNode;
  /** Apply the standard 16dp horizontal screen padding. */
  padded?: boolean;
  edges?: readonly Edge[];
  /**
   * Canvas colour, safe areas included. Defaults to the app canvas.
   */
  background?: string;
  style?: ViewStyle;
};

export function Screen({
  children,
  padded = false,
  edges = ["top", "left", "right"],
  background,
  style,
}: ScreenProps) {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={{ flex: 1, backgroundColor: background ?? colors.bg }}
    >
      <View
        style={[
          { flex: 1, paddingHorizontal: padded ? spacing.lg : 0 },
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
