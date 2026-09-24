import { Screen, AppHeader } from "@/components/ui";
import { useMiniAppTint } from "@/theme/useTheme";
import { AlertsList } from "@/features/travel/components/AlertsList";

export default function AlertsScreen() {
  const tint = useMiniAppTint("travel");
  return (
    <Screen>
      <AppHeader title="Alerts" tint={tint} />
      <AlertsList />
    </Screen>
  );
}
