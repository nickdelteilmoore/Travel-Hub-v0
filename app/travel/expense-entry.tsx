import { useLocalSearchParams } from "expo-router";

import { Screen, AppHeader } from "@/components/ui";
import { useMiniAppTint } from "@/theme/useTheme";
import { ExpenseForm } from "@/features/travel/components/ExpenseForm";

export default function ExpenseEntryScreen() {
  const tint = useMiniAppTint("travel");
  const { trip, edit } = useLocalSearchParams<{ trip?: string; edit?: string }>();

  return (
    <Screen>
      <AppHeader title={edit ? "Edit expense" : "Add expense"} tint={tint} />
      <ExpenseForm tripId={trip} editId={edit} />
    </Screen>
  );
}
