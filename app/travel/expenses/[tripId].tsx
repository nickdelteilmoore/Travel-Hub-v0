import { useLocalSearchParams } from "expo-router";

import { Screen, AppHeader } from "@/components/ui";
import { useMiniAppTint } from "@/theme/useTheme";
import { ExpensesView } from "@/features/travel/components/ExpensesView";

export default function ExpensesScreen() {
  const tint = useMiniAppTint("travel");
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  return (
    <Screen>
      <AppHeader title="Expenses" tint={tint} />
      {tripId ? <ExpensesView tripId={tripId} /> : null}
    </Screen>
  );
}
