import { View, Pressable } from "react-native";

import { LeafCard, Text } from "@/components/ui";
import { useTheme, useMiniAppPalette } from "@/theme/useTheme";
import { useTravelDocuments } from "../queries";
import { openDocument, usePinDocument } from "../mutations";

function fmtBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Boarding passes, tickets and vouchers held in the private travel-docs bucket.
 * They arrive automatically off forwarded bookings; here you open one (via a
 * short-lived signed URL) or pin it to keep. Renders nothing when a trip or
 * segment has no documents, so it can sit unconditionally on a detail screen.
 */
export function DocumentList({ tripId, segmentId }: { tripId?: string; segmentId?: string }) {
  const { spacing } = useTheme();
  const palette = useMiniAppPalette("travel");
  const { data: docs } = useTravelDocuments({ tripId, segmentId });
  const pin = usePinDocument();

  if (!docs || docs.length === 0) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="eyebrow" color="textMuted">
        Documents
      </Text>
      {docs.map((doc) => (
        <LeafCard key={doc.id} appId="travel">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Pressable style={{ flex: 1 }} onPress={() => openDocument(doc.storage_path)} accessibilityRole="button">
              <Text variant="bodyMedium" style={{ color: palette.text }} numberOfLines={1}>
                {doc.filename}
              </Text>
              <Text variant="caption" color="textMuted">
                {[doc.kind, fmtBytes(doc.bytes)].filter(Boolean).join("  ·  ")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => pin.mutate({ id: doc.id, pinned: !doc.pinned })}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={doc.pinned ? "Unpin document" : "Pin document offline"}
            >
              <Text variant="bodyMedium" style={{ color: palette.accent }}>
                {doc.pinned ? "Pinned" : "Pin"}
              </Text>
            </Pressable>
          </View>
        </LeafCard>
      ))}
    </View>
  );
}
