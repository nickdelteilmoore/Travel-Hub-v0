import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { useTheme } from "@/theme/useTheme";
import { Text } from "./Text";

export type AppHeaderProps = {
  title: string;
  /** Mini-app accent — eyebrow colour and title underline. */
  tint: string;
  /**
   * When set, renders the hero layout: an uppercase eyebrow in the
   * app accent above an Albert Sans 32pt title. Omit for the compact back-nav
   * header used by detail/modal screens.
   */
  eyebrow?: string;
  /** Optional content rendered beneath the title (readouts, switchers). */
  subtitle?: ReactNode;
  right?: ReactNode;
  /** Show the back chevron (default true). */
  showBack?: boolean;
  /** Hairline appears only when content scrolls beneath. */
  scrolled?: boolean;
};

function BackButton() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to home"
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      hitSlop={8}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
    >
      <ChevronLeft size={26} color={colors.text} />
    </Pressable>
  );
}

export function AppHeader({
  title,
  tint,
  eyebrow,
  subtitle,
  right,
  showBack = true,
  scrolled,
}: AppHeaderProps) {
  const { colors, spacing } = useTheme();

  // Hero layout — eyebrow + large Albert Sans title.
  if (eyebrow) {
    return (
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
          backgroundColor: colors.bg,
          borderBottomWidth: scrolled ? 1 : 0,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 44,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            {showBack ? <BackButton /> : null}
            <Text variant="eyebrow" style={{ color: tint }}>
              {eyebrow}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            {right}
          </View>
        </View>
        <Text variant="display" style={{ marginTop: spacing.xs }}>
          {title}
        </Text>
        {subtitle ? <View style={{ marginTop: spacing.sm }}>{subtitle}</View> : null}
      </View>
    );
  }

  // Compact layout — back chevron + medium title with accent underline.
  return (
    <View
      style={{
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.bg,
        borderBottomWidth: scrolled ? 1 : 0,
        borderBottomColor: colors.border,
      }}
    >
      {showBack ? <BackButton /> : null}

      <View style={{ flex: 1 }}>
        <Text variant="title">{title}</Text>
        <View
          style={{
            height: 3,
            width: 24,
            borderRadius: 2,
            marginTop: 2,
            backgroundColor: tint,
          }}
        />
      </View>

      <View style={{ minWidth: 44, alignItems: "flex-end", justifyContent: "center" }}>
        {right}
      </View>
    </View>
  );
}
