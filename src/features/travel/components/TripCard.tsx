import { View } from "react-native";
import { format, parseISO } from "date-fns";
import { enGB } from "date-fns/locale";
import { useRouter } from "expo-router";

import { CircularFlagBadge, LeafCard, Text } from "@/components/ui";
import { useTheme, useMiniAppPalette } from "@/theme/useTheme";
import { daysCountedFor } from "../schengen";
import type { TravelEntry } from "../queries";

/** "12–23 Jul", "19 Jun–2 Jul", or "3 Jul – now" for ongoing. */
function compactRange(entryIso: string, exitIso: string | null): string {
  const entry = parseISO(entryIso);
  const d = (date: Date, withMonth: boolean) =>
    format(date, withMonth ? "d MMM" : "d", { locale: enGB });
  if (!exitIso) return `${d(entry, true)} – now`;
  const exit = parseISO(exitIso);
  const sameMonth =
    entry.getMonth() === exit.getMonth() && entry.getFullYear() === exit.getFullYear();
  return sameMonth
    ? `${d(entry, false)}–${d(exit, true)}`
    : `${d(entry, true)}–${d(exit, true)}`;
}

export function TripCard({ entry }: { entry: TravelEntry }) {
  const { colors, spacing, radii } = useTheme();
  const palette = useMiniAppPalette("travel");
  const router = useRouter();

  const isSchengen = entry.country?.is_schengen ?? false;
  // "Still here" means a trip that has started and has no exit yet — a
  // future-dated entry with no exit is upcoming, not somewhere you are now, so
  // it must not claim you are currently there. Entries the app did not
  // create itself (e.g. imported or reconciled from segments) are the usual source
  // of a stray open-ended row; this at least keeps a not-yet-started one honest.
  const ongoing = entry.exit_date === null && parseISO(entry.entry_date) <= new Date();
  // Only the days still inside the rolling window — a trip that no longer
  // counts against the 90 shows no number at all.
  const days = daysCountedFor(
    {
      entryDate: entry.entry_date,
      exitDate: entry.exit_date,
      isSchengen,
    },
    new Date(),
  );

  return (
    <LeafCard
      appId="travel"
      accessibilityLabel={entry.country?.name ?? entry.country_code}
      onPress={() => router.push({ pathname: "/travel/entry", params: { id: entry.id } })}
      style={{ marginBottom: spacing.sm }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <CircularFlagBadge flag={entry.country?.flag_emoji ?? "🏳️"} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="listHeading" style={{ color: palette.text }}>
            {entry.country?.name ?? entry.country_code}
          </Text>
          <Text variant="caption" style={{ color: palette.text, opacity: 0.75 }}>
            {compactRange(entry.entry_date, entry.exit_date)}
          </Text>
        </View>

        {ongoing ? (
          <View
            style={{
              backgroundColor: colors.success,
              borderRadius: radii.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
            }}
          >
            <Text variant="eyebrow" style={{ color: "#FFFFFF" }}>
              Still here
            </Text>
          </View>
        ) : days > 0 ? (
          <Text
            variant="bodyBold"
            style={{ color: palette.accent }}
            accessibilityLabel={`${days} days counting towards Schengen`}
          >
            {`${days}d`}
          </Text>
        ) : null}
      </View>
    </LeafCard>
  );
}
