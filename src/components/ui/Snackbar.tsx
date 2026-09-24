import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/theme/useTheme";
import { useUiStore } from "@/stores/uiStore";
import { Text } from "./Text";

/** App-wide snackbar host. Mount once near the root. */
export function SnackbarHost() {
  const { colors, radii, spacing, elevation } = useTheme();
  const snackbar = useUiStore((s) => s.snackbar);
  const hide = useUiStore((s) => s.hideSnackbar);

  useEffect(() => {
    if (!snackbar) return;
    const timer = setTimeout(hide, snackbar.durationMs);
    return () => clearTimeout(timer);
  }, [snackbar, hide]);

  if (!snackbar) return null;

  return (
    <SafeAreaView
      edges={["bottom"]}
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
    >
      <View
        style={{
          margin: spacing.lg,
          padding: spacing.md,
          borderRadius: radii.md,
          backgroundColor: colors.text,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
          ...elevation.raised,
        }}
      >
        <Text variant="body" style={{ color: colors.bg, flex: 1 }}>
          {snackbar.message}
        </Text>
        {snackbar.action ? (
          <Pressable
            onPress={() => {
              snackbar.action?.onPress();
              hide();
            }}
            hitSlop={8}
          >
            <Text variant="bodyMedium" style={{ color: colors.star }}>
              {snackbar.action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
