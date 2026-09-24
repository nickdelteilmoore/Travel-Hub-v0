import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";

import { Screen, AppHeader } from "@/components/ui";
import { useTheme, useMiniAppPalette } from "@/theme/useTheme";
import { TravelHome } from "@/features/travel/components/TravelHome";

export default function TravelScreen() {
  const { colors } = useTheme();
  const palette = useMiniAppPalette("travel");
  const router = useRouter();

  return (
    <Screen>
      <AppHeader
        showBack={false}
        title="Travel Hub"
        tint={palette.accent}
        right={
          <Pressable
            onPress={() => router.push("/travel/entry")}
            accessibilityLabel="New trip"
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: palette.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={22} color={colors.onPrimary} strokeWidth={2.5} />
          </Pressable>
        }
      />
      <TravelHome />
    </Screen>
  );
}
