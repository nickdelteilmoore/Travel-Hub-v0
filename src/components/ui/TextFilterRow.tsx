import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/theme/useTheme";
import { Text } from "./Text";

export type TextFilterRowProps = {
  options: string[];
  value: string;
  onChange: (option: string) => void;
  /** Underline colour for the active filter — the app's accent. */
  accent: string;
  /** Active label colour; defaults to the app's primary text token. */
  activeColor?: string;
  /** Optional trailing element, e.g. a [ ✎ Manage ] link. */
  trailing?: ReactNode;
};

/**
 * text-based filter row: plain text, no pills or borders. The active
 * option is Inter Bold with a 2px solid accent underline; others are Inter
 * Medium in Muted Slate.
 */
export function TextFilterRow({
  options,
  value,
  onChange,
  accent,
  activeColor,
  trailing,
}: TextFilterRowProps) {
  const { colors, spacing, typography } = useTheme();
  const size = typography.bodyBold.fontSize;
  const lineHeight = typography.bodyBold.lineHeight;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        alignItems: "center",
        gap: spacing.xl,
        paddingHorizontal: spacing.lg,
      }}
    >
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            hitSlop={8}
            onPress={() => {
              if (!active) Haptics.selectionAsync();
              onChange(option);
            }}
            style={{ minHeight: 48, justifyContent: "center" }}
          >
            <View
              style={{
                borderBottomWidth: 2,
                borderBottomColor: active ? accent : "transparent",
                paddingBottom: spacing.xs,
              }}
            >
              {active ? (
                <Text
                  variant="bodyBold"
                  style={{ color: activeColor ?? colors.text }}
                >
                  {option}
                </Text>
              ) : (
                <Text
                  variant="bodyMedium"
                  style={{ color: colors.textMuted, fontSize: size, lineHeight }}
                >
                  {option}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
      {trailing ? <View style={{ minHeight: 48, justifyContent: "center" }}>{trailing}</View> : null}
    </ScrollView>
  );
}
