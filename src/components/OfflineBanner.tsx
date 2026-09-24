import { useSyncExternalStore } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/theme/useTheme";
import { useOnlineStatus } from "@/lib/connectivity";
import { queryClient } from "@/lib/queryClient";
import { Text } from "./ui/Text";

/** How many writes are queued (paused) waiting for a connection to come back. */
function usePausedMutationCount(): number {
  const cache = queryClient.getMutationCache();
  return useSyncExternalStore(
    (onChange) => cache.subscribe(onChange),
    () => cache.getAll().filter((m) => m.state.isPaused).length,
    () => 0,
  );
}

/**
 * A quiet, persistent bar that tells the traveller the app is offline (so an
 * edit that "just saved" isn't a lie — it's queued) and, on reconnect, that the
 * queue is syncing. Mounted once near the root; renders nothing when online with
 * nothing pending. Inverse bar for high contrast in both schemes, matching the
 * snackbar (rule 2 — tokens only).
 */
export function OfflineBanner() {
  const { colors, spacing, radii, elevation } = useTheme();
  const online = useOnlineStatus();
  const pending = usePausedMutationCount();

  if (online && pending === 0) return null;

  const message = !online
    ? pending > 0
      ? `Offline · ${pending} change${pending === 1 ? "" : "s"} will sync when you're back`
      : "You're offline · trips and receipts still work; edits save on your device"
    : "Back online · syncing your changes…";

  return (
    <SafeAreaView
      edges={["top"]}
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0 }}
    >
      <View
        style={{
          marginHorizontal: spacing.md,
          marginTop: spacing.xs,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radii.md,
          backgroundColor: colors.text,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          ...elevation.raised,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: online ? colors.primary : colors.warning,
          }}
        />
        <Text variant="caption" style={{ color: colors.bg, flex: 1 }}>
          {message}
        </Text>
      </View>
    </SafeAreaView>
  );
}
