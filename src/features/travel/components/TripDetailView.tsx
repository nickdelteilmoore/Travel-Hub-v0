import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import { Text, EmptyState, Button } from "@/components/ui";
import { useTheme } from "@/theme/useTheme";
import {
  useTrip,
  useTripSegments,
  useSegmentTypes,
  useAirports,
  useFlightStatuses,
} from "../queries";
import { tripRange } from "../segments";
import { total, formatKg, type CarbonSegment } from "../domain/carbon";
import { StemTimeline } from "./StemTimeline";
import { DocumentList } from "./DocumentList";
import { TripHero } from "./TripHero";

export function TripDetailView({ id }: { id: string }) {
  const { spacing } = useTheme();
  const router = useRouter();

  const { data: trip, isLoading, isError } = useTrip(id);
  const { data: segments = [] } = useTripSegments(id);
  const { data: types } = useSegmentTypes();
  const { data: airports } = useAirports(
    segments.flatMap((s) => [s.depart_iata, s.arrive_iata]),
  );
  const { data: live } = useFlightStatuses(
    segments.filter((s) => s.segment_type === "flight").map((s) => s.id),
  );

  // CO₂ for the trip, from stored figures or great-circle distance via airports.
  const co2 = useMemo(() => {
    const priced: CarbonSegment[] = segments.map((s) => {
      const a = s.depart_iata ? airports?.get(s.depart_iata) : null;
      const b = s.arrive_iata ? airports?.get(s.arrive_iata) : null;
      return {
        segment_type: s.segment_type,
        cabin: s.cabin,
        distance_km: s.distance_km,
        co2_kg: s.co2_kg,
        from: a ? { lat: a.latitude, lon: a.longitude } : null,
        to: b ? { lat: b.latitude, lon: b.longitude } : null,
      };
    });
    return total(priced);
  }, [segments, airports]);

  if (isLoading) {
    return (
      <View style={{ padding: spacing.lg }}>
        <Text variant="body" color="textMuted">
          Loading trip…
        </Text>
      </View>
    );
  }
  if (isError || !trip) {
    return <EmptyState title="Trip not found" subtitle="This trip isn't here. Pull back and try again." />;
  }

  const count = `${segments.length} segment${segments.length === 1 ? "" : "s"}`;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }}>
      <TripHero
        trip={trip}
        eyebrow={trip.country ? `${trip.country.flag_emoji} ${trip.country.name}` : null}
        subtitle={`${tripRange(trip.start_date, trip.end_date)} · ${count}${
          co2.priced ? ` · ${formatKg(co2.kg)}` : ""
        }`}
      />

      {types ? (
        <StemTimeline segments={segments} types={types} airports={airports} live={live} />
      ) : (
        <Text variant="body" color="textMuted">
          Loading itinerary…
        </Text>
      )}

      <DocumentList tripId={id} />

      <Button
        label="Add segment"
        variant="secondary"
        onPress={() => router.push({ pathname: "/travel/segment-entry", params: { trip: id } })}
        fullWidth
      />

      <Button
        label="Expenses"
        variant="ghost"
        onPress={() => router.push({ pathname: "/travel/expenses/[tripId]", params: { tripId: id } })}
        fullWidth
      />
    </ScrollView>
  );
}
