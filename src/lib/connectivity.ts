import { useSyncExternalStore } from "react";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";

import { isOnline } from "./netStatus";

// Teach React Query about the device's connectivity.
// Without this, RN has no `navigator.onLine`, so the default onlineManager
// always reports online and mutations never pause when the signal drops. With
// it, a lost connection *pauses* queries and mutations; a regained one resumes
// them (paused mutations replay, stale queries refetch) — the spine of editing
// trips and receipts on a plane and having them sync on landing.
//
// Idempotent: setEventListener replaces any previous listener, so importing
// this module more than once is safe.
export function setupConnectivity(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(isOnline({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      }));
    }),
  );
}

/** Reactive online flag for the offline banner and any screen that needs it. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}
