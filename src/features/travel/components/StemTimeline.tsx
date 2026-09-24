import { View } from "react-native";

import { Text, EmptyState } from "@/components/ui";
import { useTheme } from "@/theme/useTheme";
import { timeline } from "../domain/reconcile";
import { localDate } from "../domain/timezone";
import type { TravelSegment, SegmentTypeRow, FlightStatus, TravelAirport } from "../segments";
import { SegmentCard } from "./SegmentCard";

/** "N hours / N days unaccounted for", the web hub's gap-note copy. */
function gapNote(hours: number): string {
  return hours >= 24
    ? `${Math.round(hours / 24)} days unaccounted for`
    : `${Math.round(hours)} hours unaccounted for`;
}

/**
 * A whole trip as days of stem: one section per calendar day the trip touches,
 * each with its date heading, any unaccounted-time notes, and the segments that
 * start that day. RN port of stemTimeline() (travel/app.js).
 */
export function StemTimeline({
  segments,
  types,
  airports,
  live,
  gapHours = 6,
}: {
  segments: TravelSegment[];
  types: Map<string, SegmentTypeRow>;
  airports?: Map<string, TravelAirport>;
  live?: Map<string, FlightStatus>;
  gapHours?: number;
}) {
  const { spacing, colors } = useTheme();
  const { days } = timeline(segments, { gapHours });

  if (!days.length) {
    return <EmptyState title="Nothing booked yet" subtitle="This trip has no flights, stays or plans logged." />;
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {days.map((day) => (
        <View key={day.day} style={{ gap: spacing.sm }}>
          <Text variant="eyebrow" color="textMuted">
            {localDate(`${day.day}T12:00:00Z`, "UTC", { year: true })}
          </Text>
          {day.gaps.map((g) => (
            <Text key={g.from} variant="caption" style={{ color: colors.textMuted, fontStyle: "italic" }}>
              {gapNote(g.hours)}
            </Text>
          ))}
          {day.segments.map((seg) => (
            <SegmentCard
              key={seg.id}
              seg={seg}
              types={types}
              airports={airports}
              live={live?.get(seg.id)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
