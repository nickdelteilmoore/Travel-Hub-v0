import { ScrollView, View, Pressable } from "react-native";
import { format, parseISO } from "date-fns";
import { enGB } from "date-fns/locale";
import { useRouter } from "expo-router";

import { LeafCard, Text, EmptyState } from "@/components/ui";
import { useTheme } from "@/theme/useTheme";
import { useAlerts, type TravelAlertRow } from "../queries";
import { useMarkAlertRead } from "../mutations";

function toneColorFor(severity: string, colors: { danger: string; warning: string; textMuted: string }): string {
  if (severity === "alert") return colors.danger;
  if (severity === "warn") return colors.warning;
  return colors.textMuted;
}

function AlertCard({ alert }: { alert: TravelAlertRow }) {
  const { spacing, colors } = useTheme();
  const router = useRouter();
  const markRead = useMarkAlertRead();
  const unread = !alert.read_at;
  const color = toneColorFor(alert.severity, colors);

  return (
    <Pressable
      onPress={() => {
        if (unread) markRead.mutate(alert.id);
        if (alert.segment_id) router.push({ pathname: "/travel/segment/[id]", params: { id: alert.segment_id } });
      }}
      accessibilityRole="button"
    >
      <LeafCard appId="travel" style={{ marginBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginTop: 6, opacity: unread ? 1 : 0.3 }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="listHeading">{alert.title}</Text>
            {alert.body ? (
              <Text variant="caption" color="textMuted">
                {alert.body}
              </Text>
            ) : null}
            <Text variant="eyebrow" color="textMuted">
              {format(parseISO(alert.created_at), "d MMM, HH:mm", { locale: enGB })}
            </Text>
          </View>
        </View>
      </LeafCard>
    </Pressable>
  );
}

export function AlertsList() {
  const { spacing } = useTheme();
  const { data: alerts, isLoading } = useAlerts();

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
      {isLoading ? (
        <Text variant="body" color="textMuted">
          Loading…
        </Text>
      ) : alerts && alerts.length ? (
        alerts.map((a) => <AlertCard key={a.id} alert={a} />)
      ) : (
        <EmptyState title="No alerts" subtitle="Gate changes, delays and baggage belts will show up here." />
      )}
    </ScrollView>
  );
}
