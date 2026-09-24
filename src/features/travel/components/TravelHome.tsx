import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";

import { LeafCard, Text, EmptyState } from "@/components/ui";
import { useTheme, useMiniAppPalette } from "@/theme/useTheme";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  useTravelEntries,
  useVisitedCountries,
  useTrips,
  useAlerts,
  type TravelTrip,
} from "../queries";
import type { SchengenEntry } from "../schengen";
import { visitedCountrySet } from "../visited";
import { WorldMap } from "./WorldMap";
import { TravelProgress } from "./TravelProgress";
import { TripListItem } from "./TripListItem";

/** A trip's effective last day, for the upcoming/past split. */
function lastDay(trip: TravelTrip): string {
  return trip.end_date || trip.start_date || "";
}

/**
 * The Travel Hub home. Map and Schengen readout still derive from
 * `travel_entries` (unchanged); the trip lists below now read real
 * `travel_trips`, each tapping into its full itinerary — which is also what
 * retires the stray open-ended "– now" rows the derived entries used to show.
 */
export function TravelHome() {
  const { spacing, colors } = useTheme();
  const palette = useMiniAppPalette("travel");
  const router = useRouter();
  const { userId } = useAuth();
  const { data: alerts } = useAlerts();
  const unreadAlerts = (alerts ?? []).filter((a) => !a.read_at).length;
  const [traveler, setTraveler] = useState<string | null>(null);

  useEffect(() => {
    if (!traveler && userId) setTraveler(userId);
  }, [userId, traveler]);

  const { data: entries } = useTravelEntries(traveler);
  const { data: visitedCountries } = useVisitedCountries(traveler);
  const { data: trips, isLoading: tripsLoading, isError: tripsError } = useTrips(traveler);

  const logEntries = entries ?? [];
  const schengenEntries: SchengenEntry[] = logEntries.map((e) => ({
    entryDate: e.entry_date,
    exitDate: e.exit_date,
    isSchengen: e.country?.is_schengen ?? false,
  }));

  const visited = useMemo(
    () => visitedCountrySet(logEntries, visitedCountries ?? []),
    [logEntries, visitedCountries],
  );

  const today = format(new Date(), "yyyy-MM-dd");
  const { upcoming, past } = useMemo(() => {
    const all = trips ?? [];
    return {
      upcoming: all
        .filter((t) => lastDay(t) >= today)
        .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || "")),
      past: all.filter((t) => lastDay(t) < today), // query already returns start_date desc
    };
  }, [trips, today]);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 32 }}>
      <View style={{ gap: spacing.xs }}>
        <WorldMap visited={visited} />
        <TravelProgress visitedCount={visited.size} schengenEntries={schengenEntries} />
      </View>

      {unreadAlerts > 0 ? (
        <Pressable onPress={() => router.push("/travel/alerts")} accessibilityRole="button">
          <LeafCard appId="travel" style={{ marginTop: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Bell size={20} color={colors.danger} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text variant="listHeading" style={{ color: palette.text }}>
                  Alerts
                </Text>
                <Text variant="caption" style={{ color: palette.text, opacity: 0.75 }}>
                  {unreadAlerts} new · gate changes, delays and baggage
                </Text>
              </View>
              <View
                style={{
                  minWidth: 24,
                  height: 24,
                  paddingHorizontal: 6,
                  borderRadius: 12,
                  backgroundColor: colors.danger,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text variant="eyebrow" style={{ color: "#FFFFFF" }}>
                  {unreadAlerts}
                </Text>
              </View>
            </View>
          </LeafCard>
        </Pressable>
      ) : null}

      <View style={{ marginTop: spacing.md }}>
        <Text variant="eyebrow" color="textMuted" style={{ marginBottom: spacing.sm }}>
          Upcoming trips
        </Text>
        {tripsLoading ? (
          <Text variant="body" color="textMuted">
            Loading your trips…
          </Text>
        ) : tripsError ? (
          <Text variant="body" color="textMuted">
            Couldn&apos;t load trips. Pull to refresh.
          </Text>
        ) : upcoming.length ? (
          upcoming.map((t) => <TripListItem key={t.id} trip={t} />)
        ) : (
          <Text variant="body" color="textMuted">
            No trips ahead. Tap + to plan one.
          </Text>
        )}
      </View>

      <View style={{ marginTop: spacing.md }}>
        <Text variant="eyebrow" color="textMuted" style={{ marginBottom: spacing.sm }}>
          Trip history
        </Text>
        {past.length ? (
          past.map((t) => <TripListItem key={t.id} trip={t} />)
        ) : !tripsLoading ? (
          <EmptyState title="No past trips" subtitle="Trips you've taken will appear here." />
        ) : null}
      </View>

    </ScrollView>
  );
}
