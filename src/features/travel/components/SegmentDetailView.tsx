import { View } from "react-native";
import { useRouter } from "expo-router";

import { LeafCard, Text, EmptyState, Button } from "@/components/ui";
import { useTheme, useMiniAppPalette } from "@/theme/useTheme";
import { useSegment, useSegmentTypes, useAirports, useFlightStatuses, useFlightWatch } from "../queries";
import { useToggleFlightWatch } from "../mutations";
import { statusOf, typeOf, segmentTitle, type TravelSegment, type SegmentTypeRow, type TravelAirport } from "../segments";
import { localTime, localDate, zoneLabel, duration } from "../domain/timezone";
import { StatusPill } from "./StatusPill";
import { DocumentList } from "./DocumentList";
import { HotelMap } from "./HotelMap";

type End = "depart" | "arrive";

function EndBlock({
  seg,
  which,
  type,
  airports,
}: {
  seg: TravelSegment;
  which: End;
  type: SegmentTypeRow;
  airports?: Map<string, TravelAirport>;
}) {
  const { spacing } = useTheme();
  const palette = useMiniAppPalette("travel");
  const at = which === "depart" ? seg.depart_at : seg.arrive_at;
  if (!at) return null;
  const tz = which === "depart" ? seg.depart_tz : seg.arrive_tz || seg.depart_tz;
  const iata = which === "depart" ? seg.depart_iata : seg.arrive_iata;
  const place = which === "depart" ? seg.depart_place : seg.arrive_place;
  const airport = iata ? airports?.get(iata) : null;
  const heading = type.is_lodging
    ? which === "depart"
      ? "Check in"
      : "Check out"
    : which === "depart"
      ? "Departs"
      : "Arrives";
  const where = airport ? `${airport.name}${airport.city ? `, ${airport.city}` : ""}` : place || iata || "";

  return (
    <View style={{ flex: 1, minWidth: 150, gap: 2 }}>
      <Text variant="eyebrow" color="textMuted">
        {heading}
      </Text>
      <Text variant="title" style={{ color: palette.text }}>
        {localTime(at, tz)}
      </Text>
      <Text variant="caption" color="textMuted">
        {localDate(at, tz)}
        {zoneLabel(at, tz) ? ` · ${zoneLabel(at, tz)}` : ""}
      </Text>
      {where ? (
        <Text variant="caption" style={{ color: palette.text, opacity: 0.8, marginTop: spacing.xs }}>
          {where}
        </Text>
      ) : null}
    </View>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="bodyMedium" style={{ flexShrink: 1, textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );
}

export function SegmentDetailView({ id }: { id: string }) {
  const { spacing } = useTheme();
  const palette = useMiniAppPalette("travel");
  const router = useRouter();

  const { data: seg, isLoading, isError } = useSegment(id);
  const { data: types } = useSegmentTypes();
  const { data: airports } = useAirports([seg?.depart_iata, seg?.arrive_iata]);
  const isFlight = seg?.segment_type === "flight";
  const { data: live } = useFlightStatuses(isFlight ? [id] : []);
  const { data: watch } = useFlightWatch(id, isFlight);
  const toggleWatch = useToggleFlightWatch();

  if (isLoading || !types) {
    return (
      <View style={{ padding: spacing.lg }}>
        <Text variant="body" color="textMuted">
          Loading…
        </Text>
      </View>
    );
  }
  if (isError || !seg) {
    return <EmptyState title="Segment not found" subtitle="This plan isn't here any more." />;
  }

  const type = typeOf(seg.segment_type, types);
  const liveRow = live?.get(id) ?? null;
  const status = statusOf(seg, liveRow);
  const dur = duration(seg.depart_at, seg.arrive_at);

  const details: { label: string; value: string }[] = [];
  if (seg.carrier || seg.number) details.push({ label: "Operator", value: [seg.carrier, seg.number].filter(Boolean).join(" ") });
  if (seg.booking_ref) details.push({ label: "Reference", value: seg.booking_ref });
  if (seg.seat) details.push({ label: type.is_lodging ? "Room" : "Seat", value: seg.seat });
  if (seg.cabin) details.push({ label: "Cabin", value: seg.cabin });
  if (dur) details.push({ label: "Duration", value: dur });
  if (seg.address) details.push({ label: "Address", value: seg.address });
  if (seg.phone) details.push({ label: "Phone", value: seg.phone });

  const liveRows: { label: string; value: string }[] = [];
  if (liveRow) {
    if (liveRow.depart_terminal) liveRows.push({ label: "Terminal", value: liveRow.depart_terminal });
    if (liveRow.depart_gate) liveRows.push({ label: "Gate", value: liveRow.depart_gate });
    if (liveRow.arrive_terminal) liveRows.push({ label: "Arr. terminal", value: liveRow.arrive_terminal });
    if (liveRow.arrive_belt) liveRows.push({ label: "Baggage belt", value: liveRow.arrive_belt });
    if (liveRow.depart_delay_min) liveRows.push({ label: "Departure delay", value: `${liveRow.depart_delay_min} min` });
    if (liveRow.arrive_estimated)
      liveRows.push({ label: "Estimated in", value: localTime(liveRow.arrive_estimated, seg.arrive_tz) });
  }

  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      <View style={{ gap: 4 }}>
        <Text variant="eyebrow" color="textMuted">
          {type.label}
        </Text>
        <Text variant="display" style={{ color: palette.text }}>
          {segmentTitle(seg, type)}
        </Text>
        <StatusPill status={status} />
      </View>

      <LeafCard appId="travel">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.lg }}>
          <EndBlock seg={seg} which="depart" type={type} airports={airports} />
          <EndBlock seg={seg} which="arrive" type={type} airports={airports} />
        </View>
      </LeafCard>

      {details.length ? (
        <LeafCard appId="travel">
          <View style={{ gap: spacing.sm }}>
            {details.map((d) => (
              <KV key={d.label} label={d.label} value={d.value} />
            ))}
          </View>
        </LeafCard>
      ) : null}

      {type.is_lodging ? <HotelMap seg={seg} /> : null}

      {isFlight ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="eyebrow" color="textMuted">
            Live status
          </Text>
          {liveRows.length ? (
            <LeafCard appId="travel">
              <View style={{ gap: spacing.sm }}>
                {liveRows.map((d) => (
                  <KV key={d.label} label={d.label} value={d.value} />
                ))}
                {liveRow ? (
                  <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
                    Last checked {localDate(liveRow.checked_at)} {localTime(liveRow.checked_at)}
                  </Text>
                ) : null}
              </View>
            </LeafCard>
          ) : (
            <Text variant="body" color="textMuted">
              No live status yet.
            </Text>
          )}
          {seg.carrier && seg.number ? (
            <>
              <Text variant="caption" color="textMuted">
                {watch?.paused
                  ? "Auto-checks are paused for this flight."
                  : watch?.active
                    ? "Watching automatically — checks get more frequent as departure nears."
                    : watch
                      ? "Auto-checks have stopped (the flight has departed)."
                      : "Not watched yet."}
              </Text>
              <Button
                label={watch && !watch.paused && watch.active ? "Stop watching" : "Watch flight"}
                variant="ghost"
                loading={toggleWatch.isPending}
                onPress={() =>
                  toggleWatch.mutate({
                    segmentId: seg.id,
                    watching: !!(watch && !watch.paused && watch.active),
                  })
                }
              />
            </>
          ) : null}
        </View>
      ) : null}

      <DocumentList segmentId={seg.id} />

      {seg.notes ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="eyebrow" color="textMuted">
            Notes
          </Text>
          <Text variant="body">{seg.notes}</Text>
        </View>
      ) : null}

      <Button
        label="Edit segment"
        variant="secondary"
        onPress={() => router.push({ pathname: "/travel/segment-entry", params: { edit: seg.id } })}
        fullWidth
      />
      {seg.trip_id ? (
        <Button
          label="Back to trip"
          variant="ghost"
          onPress={() => router.push({ pathname: "/travel/trip/[id]", params: { id: seg.trip_id as string } })}
        />
      ) : null}
    </View>
  );
}
