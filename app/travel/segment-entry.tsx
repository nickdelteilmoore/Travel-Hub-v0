import { useLocalSearchParams } from "expo-router";

import { Screen, AppHeader } from "@/components/ui";
import { useMiniAppTint } from "@/theme/useTheme";
import { SegmentForm } from "@/features/travel/components/SegmentForm";

export default function SegmentEntryScreen() {
  const tint = useMiniAppTint("travel");
  const { edit, trip } = useLocalSearchParams<{ edit?: string; trip?: string }>();

  return (
    <Screen>
      <AppHeader title={edit ? "Edit segment" : "Add segment"} tint={tint} />
      <SegmentForm editId={edit} tripId={trip} />
    </Screen>
  );
}
