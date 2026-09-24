import { useState } from "react";
import { Pressable, View } from "react-native";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";

import { Sheet, Text } from "@/components/ui";
import { useTheme, useMiniAppPalette } from "@/theme/useTheme";
import { computeSchengenStatus, type SchengenEntry } from "../schengen";

const TOTAL_COUNTRIES = 197; // sovereign states
const fmt = (d: Date) => format(d, "d MMM", { locale: enGB });

/**
 * one-line readout: "N / 197 countries (P%) · Schengen: U / 90 days".
 * Tapping the Schengen segment opens the rolling-window breakdown.
 */
export function TravelProgress({
  visitedCount,
  schengenEntries,
}: {
  visitedCount: number;
  schengenEntries: SchengenEntry[];
}) {
  const { spacing } = useTheme();
  const palette = useMiniAppPalette("travel");
  const [open, setOpen] = useState(false);

  const status = computeSchengenStatus(schengenEntries, new Date());
  const pct = Math.round((visitedCount / TOTAL_COUNTRIES) * 100);

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          paddingVertical: spacing.md,
        }}
      >
        <Text variant="bodyMedium" color="textMuted">
          {`${visitedCount} / ${TOTAL_COUNTRIES} countries (${pct}%)   ·   `}
        </Text>
        <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button">
          <Text variant="bodyBold" style={{ color: palette.accent }}>
            {`Schengen: ${status.used} / 90 days`}
          </Text>
        </Pressable>
      </View>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Schengen window">
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <Text variant="title" style={{ color: palette.accent }}>
            {`${status.remaining} days remaining`}
          </Text>
          <Text variant="bodyMedium" color="textMuted">
            {`${status.used} of 90 days used in the last 180`}
          </Text>
          {status.mustExitBy ? (
            <Text variant="body" color="textMuted">
              {`If you enter today, exit by ${fmt(status.mustExitBy)}`}
            </Text>
          ) : null}
          {status.nextFreeUp ? (
            <Text variant="body" color="textMuted">
              {`Next day frees up: ${fmt(status.nextFreeUp)}`}
            </Text>
          ) : null}
        </View>
      </Sheet>
    </>
  );
}
