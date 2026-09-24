import { useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { format, parseISO } from "date-fns";
import { enGB } from "date-fns/locale";

import { Text, LeafCard, Button, EmptyState } from "@/components/ui";
import { useTheme, useMiniAppPalette } from "@/theme/useTheme";
import { toast } from "@/stores/uiStore";
import { useTripExpenses, useReceiptUrls, useTrip, type TripExpenseRow } from "../queries";
import { formatMoney, totalsLabel } from "../expenses";
import { tripRange } from "../segments";
import { exportExpensesCsv, exportExpensesPdf } from "../expenseExport";

function ExpenseCard({
  row,
  photoUrl,
  onPress,
}: {
  row: TripExpenseRow;
  photoUrl?: string;
  onPress: () => void;
}) {
  const { spacing, radii, colors } = useTheme();
  const palette = useMiniAppPalette("travel");
  return (
    <LeafCard appId="travel" onPress={onPress} accessibilityLabel={`Edit expense ${row.reason ?? ""}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={{ width: 44, height: 44, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt }}
          />
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyMedium" style={{ color: palette.text }}>
            {row.reason || "Expense"}
          </Text>
          <Text variant="caption" color="textMuted">
            {row.spent_on ? format(parseISO(row.spent_on), "d MMM yyyy", { locale: enGB }) : "No date"}
          </Text>
        </View>
        <Text variant="bodyMedium" style={{ color: palette.text }}>
          {formatMoney(row.amount, row.currency)}
        </Text>
      </View>
    </LeafCard>
  );
}

/** A trip's running expense list, with capture entry and PDF/CSV export
 * (DESIGN.md). Reached from the bottom of the trip page. */
export function ExpensesView({ tripId }: { tripId: string }) {
  const { spacing } = useTheme();
  const router = useRouter();
  const { data: trip } = useTrip(tripId);
  const { data: expenses, isLoading, isError } = useTripExpenses(tripId);
  const { data: urls } = useReceiptUrls((expenses ?? []).map((e) => e.photo_path));
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);

  const rows = expenses ?? [];
  const totals = totalsLabel(rows);
  const title = trip?.title || "Trip";

  async function runExport(kind: "pdf" | "csv") {
    if (!rows.length) return;
    setExporting(kind);
    try {
      if (kind === "csv") {
        await exportExpensesCsv(title, rows);
      } else {
        const subtitle = [
          `${rows.length} expense${rows.length === 1 ? "" : "s"}`,
          tripRange(trip?.start_date ?? null, trip?.end_date ?? null),
        ]
          .filter(Boolean)
          .join(" · ");
        await exportExpensesPdf({ tripTitle: title, subtitle, rows, photoUrls: urls ?? new Map() });
      }
    } catch {
      toast("Couldn't export — try again");
    } finally {
      setExporting(null);
    }
  }

  const addExpense = () =>
    router.push({ pathname: "/travel/expense-entry", params: { trip: tripId } });

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
      {totals ? (
        <View style={{ gap: 2 }}>
          <Text variant="eyebrow" color="textMuted">
            Total
          </Text>
          <Text variant="title">{totals}</Text>
        </View>
      ) : null}

      <Button label="Add expense" onPress={addExpense} fullWidth />

      {isLoading ? (
        <Text variant="body" color="textMuted">
          Loading…
        </Text>
      ) : isError ? (
        <EmptyState title="Couldn't load expenses" subtitle="Check your connection and try again." />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No expenses yet"
          subtitle="Tap Add expense to photograph your first receipt."
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {rows.map((row) => (
            <ExpenseCard
              key={row.id}
              row={row}
              photoUrl={row.photo_path ? urls?.get(row.photo_path) : undefined}
              onPress={() =>
                router.push({ pathname: "/travel/expense-entry", params: { edit: row.id } })
              }
            />
          ))}
        </View>
      )}

      {rows.length ? (
        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Export PDF"
              variant="secondary"
              onPress={() => runExport("pdf")}
              loading={exporting === "pdf"}
              disabled={!!exporting}
              fullWidth
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Export CSV"
              variant="secondary"
              onPress={() => runExport("csv")}
              loading={exporting === "csv"}
              disabled={!!exporting}
              fullWidth
            />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
