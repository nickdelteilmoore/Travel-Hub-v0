import { View } from "react-native";
import { useRouter } from "expo-router";

import { CircularFlagBadge, LeafCard, Text } from "@/components/ui";
import { useTheme, useMiniAppPalette } from "@/theme/useTheme";
import { tripRange, tripCountdown } from "../segments";
import type { TravelTrip } from "../queries";

const COUNTDOWN_WORD: Record<"today" | "ongoing" | "been", string> = {
  today: "Today",
  ongoing: "Ongoing",
  been: "Been",
};

/** One trip on the hub: flag, title, date range, and a days-to-go countdown. */
export function TripListItem({ trip }: { trip: TravelTrip }) {
  const { spacing } = useTheme();
  const palette = useMiniAppPalette("travel");
  const router = useRouter();

  const count = tripCountdown(trip, new Date());

  return (
    <LeafCard
      appId="travel"
      accessibilityLabel={trip.title}
      onPress={() => router.push({ pathname: "/travel/trip/[id]", params: { id: trip.id } })}
      style={{ marginBottom: spacing.sm }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <CircularFlagBadge flag={trip.country?.flag_emoji ?? "🧳"} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="listHeading" style={{ color: palette.text }} numberOfLines={1}>
            {trip.title}
          </Text>
          <Text variant="caption" style={{ color: palette.text, opacity: 0.75 }}>
            {tripRange(trip.start_date, trip.end_date)}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          {count.kind === "days" ? (
            <>
              <Text variant="bodyBold" style={{ color: palette.accent }}>
                {count.days}
              </Text>
              <Text variant="eyebrow" color="textMuted">
                {count.days === 1 ? "day to go" : "days to go"}
              </Text>
            </>
          ) : (
            <Text variant="eyebrow" color="textMuted">
              {COUNTDOWN_WORD[count.kind]}
            </Text>
          )}
        </View>
      </View>
    </LeafCard>
  );
}
