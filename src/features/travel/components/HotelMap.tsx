import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import * as Linking from "expo-linking";
import { WebView } from "react-native-webview";

import { LeafCard, Text, Button } from "@/components/ui";
import { useTheme, useMiniAppPalette } from "@/theme/useTheme";
import { useHotelLocation } from "../queries";
import type { TravelSegment } from "../segments";
import {
  buildLeafletHtml,
  hotelQuery,
  metroDistanceLabel,
  metroKindLabel,
  resolveHotelCoords,
} from "../hotelMap";

const MAP_HEIGHT = 210;

/** Android maps intent for a point, or a plain address search when we have no
 * coordinates yet — either opens the phone's maps app. */
function mapsUrl(opts: { lat?: number; lng?: number; label: string }): string {
  const label = encodeURIComponent(opts.label);
  if (opts.lat != null && opts.lng != null) {
    return `geo:${opts.lat},${opts.lng}?q=${opts.lat},${opts.lng}(${label})`;
  }
  return `geo:0,0?q=${label}`;
}

/**
 * The hotel's location on a map, with the nearest metro pinned (DESIGN.md).
 * Only rendered for lodging segments. The map is an enhancement layered over
 * the address the detail view already shows, so every failure mode still leaves
 * the guest able to find the place: loading, offline/error and no-metro states
 * all degrade to text plus an "Open in Maps" handoff.
 */
export function HotelMap({ seg }: { seg: TravelSegment }) {
  const { spacing, radii, colors } = useTheme();
  const palette = useMiniAppPalette("travel");

  const coords = useMemo(() => resolveHotelCoords(seg), [seg]);
  const query = useMemo(() => hotelQuery(seg), [seg]);
  const label = seg.title || seg.address || "Hotel";

  const { data, isLoading, isError } = useHotelLocation({
    segmentId: seg.id,
    coords,
    query,
  });

  const html = useMemo(() => {
    if (!data) return null;
    return buildLeafletHtml({
      hotel: data.hotel,
      metro: data.metro,
      hotelColor: palette.accent,
      metroColor: colors.terracotta,
      pinStroke: colors.surface,
      background: colors.surfaceAlt,
      hotelLabel: label,
    });
  }, [data, palette.accent, colors.terracotta, colors.surface, colors.surfaceAlt, label]);

  // Nothing to place — no address, no coordinates. Say nothing. (After every
  // hook, so the hook order stays stable across renders.)
  if (!coords && !query) return null;

  const header = (
    <Text variant="eyebrow" color="textMuted">
      Location
    </Text>
  );

  const frame = {
    height: MAP_HEIGHT,
    borderRadius: radii.md,
    overflow: "hidden" as const,
    backgroundColor: colors.surfaceAlt,
  };

  if (isError || (!isLoading && !data)) {
    return (
      <View style={{ gap: spacing.sm }}>
        {header}
        <LeafCard appId="travel">
          <View style={{ gap: spacing.xs }}>
            <Text variant="bodyMedium" style={{ color: palette.text }}>
              {seg.address || label}
            </Text>
            <Text variant="caption" color="textMuted">
              The map couldn&apos;t load right now. It&apos;ll appear once you&apos;re back online.
            </Text>
          </View>
        </LeafCard>
        <Button
          label="Open in Maps"
          variant="ghost"
          onPress={() => Linking.openURL(mapsUrl({ label: query || label }))}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {header}
      <View style={frame} accessibilityLabel={`Map showing ${label}`}>
        {isLoading || !html ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
            <ActivityIndicator color={palette.accent} />
            <Text variant="caption" color="textMuted">
              Finding the hotel…
            </Text>
          </View>
        ) : (
          <WebView
            originWhitelist={["*"]}
            source={{ html }}
            style={{ flex: 1, backgroundColor: colors.surfaceAlt }}
            scrollEnabled={false}
            androidLayerType="hardware"
          />
        )}
      </View>

      {data ? (
        <LeafCard appId="travel">
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
            <View style={{ gap: 2, flexShrink: 1 }}>
              <Text variant="eyebrow" color="textMuted">
                Nearest metro
              </Text>
              {data.metro ? (
                <>
                  <Text variant="bodyMedium" style={{ color: palette.text }}>
                    {data.metro.name}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {metroKindLabel(data.metro.kind)} · {metroDistanceLabel(data.metro.distanceM)} away
                  </Text>
                </>
              ) : (
                <Text variant="bodyMedium" color="textMuted">
                  No metro station nearby
                </Text>
              )}
            </View>
          </View>
        </LeafCard>
      ) : null}

      <Button
        label="Open in Maps"
        variant="ghost"
        onPress={() =>
          Linking.openURL(mapsUrl({ lat: data?.hotel.lat, lng: data?.hotel.lng, label: query || label }))
        }
      />
    </View>
  );
}
