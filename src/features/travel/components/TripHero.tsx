import { useState } from "react";
import { Image, View } from "react-native";
import { SvgXml } from "react-native-svg";

import { Text } from "@/components/ui";
import { useTheme, useMiniAppPalette } from "@/theme/useTheme";
import { resolveCoverImage, postcardSVG } from "../cover";
import type { TravelTrip } from "../queries";

/**
 * The trip hero banner — a destination photo keyed off the trip (Palermo →
 * it-palermo.jpg) when one is bundled, else a generated botanical postcard, so
 * a hero is never blank. The trip name, flag and dates sit lower-left over a
 * dark scrim.
 */
export function TripHero({
  trip,
  eyebrow,
  subtitle,
}: {
  trip: TravelTrip;
  eyebrow?: string | null;
  subtitle?: string | null;
}) {
  const { radii, spacing } = useTheme();
  const palette = useMiniAppPalette("travel");
  const photo = resolveCoverImage(trip);
  // Photo may 404 or decode-fail at runtime (a swapped asset); fall through to
  // the postcard rather than showing a broken box.
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        eyebrow ? `${trip.title} — ${eyebrow.replace(/^\S+\s/, "")}` : trip.title
      }
      style={{
        aspectRatio: 16 / 10,
        borderRadius: radii.lg,
        overflow: "hidden",
        justifyContent: "flex-end",
        backgroundColor: palette.surface,
      }}
    >
      {photo && !photoFailed ? (
        <Image
          source={photo}
          resizeMode="cover"
          onError={() => setPhotoFailed(true)}
          style={{ position: "absolute", width: "100%", height: "100%" }}
        />
      ) : (
        <SvgXml
          xml={postcardSVG(trip.title || trip.primary_country_code || "trip")}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute" }}
        />
      )}

      {/* Bottom scrim keeps the overlaid text legible over any scene. Stacked
          translucent bands fake a fade without pulling in a gradient native
          module, so the hero needs no prebuild to render. */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "55%", backgroundColor: "rgba(0,0,0,0.18)" }} />
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "32%", backgroundColor: "rgba(0,0,0,0.28)" }} />

      <View style={{ padding: spacing.lg, gap: spacing.xs / 2 }}>
        {eyebrow ? (
          <Text variant="eyebrow" style={{ color: "#FFFFFF", opacity: 0.9 }}>
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="display" style={{ color: "#FFFFFF" }}>
          {trip.title}
        </Text>
        {subtitle ? (
          <Text variant="caption" style={{ color: "#FFFFFF", opacity: 0.85 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
