import { useLocalSearchParams } from "expo-router";

import { Screen, AppHeader } from "@/components/ui";
import { useMiniAppTint } from "@/theme/useTheme";
import { TripDetailView } from "@/features/travel/components/TripDetailView";

export default function TripScreen() {
  const tint = useMiniAppTint("travel");
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <AppHeader title="Trip" tint={tint} />
      {id ? <TripDetailView id={id} /> : null}
    </Screen>
  );
}
