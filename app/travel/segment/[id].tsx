import { ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Screen, AppHeader } from "@/components/ui";
import { useMiniAppTint } from "@/theme/useTheme";
import { SegmentDetailView } from "@/features/travel/components/SegmentDetailView";

export default function SegmentScreen() {
  const tint = useMiniAppTint("travel");
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <AppHeader title="Plan" tint={tint} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {id ? <SegmentDetailView id={id} /> : null}
      </ScrollView>
    </Screen>
  );
}
