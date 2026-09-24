import { View } from "react-native";
import { useRouter } from "expo-router";

import { LeafCard, Text } from "@/components/ui";
import { useTheme, useMiniAppPalette } from "@/theme/useTheme";
import { localTime, dayShift } from "../domain/timezone";
import {
  statusOf,
  typeOf,
  segmentTitle,
  spanLabel,
  type TravelSegment,
  type SegmentTypeRow,
  type FlightStatus,
  type TravelAirport,
} from "../segments";
import { formatKg } from "../domain/carbon";
import { SegmentIcon } from "./SegmentIcon";
import { StatusPill, useToneColor } from "./StatusPill";

/** "LHR" or a place name; the airport name is available on the detail screen. */
function endLabel(iata: string | null, place: string | null): string {
  return iata || place || "";
}

/** '07:55 → 08:55⁺¹' — the day shift is marked, never left to be guessed. */
function TimePair({ seg }: { seg: TravelSegment }) {
  const { colors } = useTheme();
  const dep = seg.depart_at ? localTime(seg.depart_at, seg.depart_tz) : "";
  const arr = seg.arrive_at ? localTime(seg.arrive_at, seg.arrive_tz || seg.depart_tz) : "";
  if (!dep && !arr) return null;
  if (!arr) {
    return (
      <Text variant="bodyMedium" style={{ color: colors.text }}>
        {dep}
      </Text>
    );
  }
  const shift = dayShift(seg.depart_at, seg.depart_tz, seg.arrive_at, seg.arrive_tz);
  return (
    <Text variant="bodyMedium" style={{ color: colors.text }}>
      {dep} → {arr}
      {shift ? (
        <Text variant="caption" style={{ color: colors.textMuted }}>
          {" "}
          {shift > 0 ? "+" : "−"}
          {Math.abs(shift)}
        </Text>
      ) : null}
    </Text>
  );
}

export function SegmentCard({
  seg,
  types,
  airports,
  live,
}: {
  seg: TravelSegment;
  types: Map<string, SegmentTypeRow>;
  airports?: Map<string, TravelAirport>;
  live?: FlightStatus | null;
}) {
  const { colors, spacing } = useTheme();
  const palette = useMiniAppPalette("travel");
  const router = useRouter();

  const type = typeOf(seg.segment_type, types);
  const status = statusOf(seg, live);
  const toneColor = useToneColor(status.tone);
  const cancelled = seg.status === "cancelled";

  const route = [endLabel(seg.depart_iata, seg.depart_place), endLabel(seg.arrive_iata, seg.arrive_place)]
    .filter(Boolean)
    .join("  ›  ");

  const meta: string[] = [];
  const dwell = spanLabel(seg, type);
  if (dwell) meta.push(dwell);
  if (seg.booking_ref) meta.push(seg.booking_ref);
  if (seg.seat) meta.push(`Seat ${seg.seat}`);
  if (live?.arrive_belt) meta.push(`Belt ${live.arrive_belt}`);
  if (seg.co2_kg != null) meta.push(formatKg(Number(seg.co2_kg)));

  void airports; // reserved for future inline airport names; keeps the prop stable

  return (
    <LeafCard
      appId="travel"
      accessibilityLabel={`${type.label}: ${segmentTitle(seg, type)}`}
      onPress={() => router.push({ pathname: "/travel/segment/[id]", params: { id: seg.id } })}
      style={{ marginBottom: spacing.sm }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
        <View style={{ paddingTop: 2 }}>
          <SegmentIcon code={seg.segment_type} color={palette.accent} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
            <Text
              variant="listHeading"
              style={{
                color: palette.text,
                flex: 1,
                textDecorationLine: cancelled ? "line-through" : "none",
              }}
              numberOfLines={1}
            >
              {segmentTitle(seg, type)}
            </Text>
            <Text variant="eyebrow" color="textMuted">
              {type.label}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs }}>
            <TimePair seg={seg} />
            {route ? (
              <Text variant="caption" style={{ color: palette.text, opacity: 0.75 }}>
                · {route}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm }}>
            <StatusPill status={status} />
            {meta.length ? (
              <Text variant="caption" color="textMuted">
                {meta.join("  ·  ")}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
      {seg.needs_review ? (
        <View style={{ marginTop: spacing.xs }}>
          <Text variant="eyebrow" style={{ color: colors.warning }}>
            Needs review
          </Text>
        </View>
      ) : null}
    </LeafCard>
  );
}
