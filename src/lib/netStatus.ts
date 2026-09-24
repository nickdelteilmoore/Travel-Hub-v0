// Pure connectivity predicate, kept side-effect-free so it unit-tests without
// the native NetInfo module (hard rule 7 in spirit). `connectivity.ts` feeds it
// the raw NetInfo state; everything else reads the boolean it returns.

/** The shape we care about from a NetInfo state — a structural subset so the
 * real `NetInfoState` satisfies it without importing the native module here. */
export type NetSnapshot = {
  isConnected: boolean | null;
  /** null when NetInfo hasn't determined reachability yet. */
  isInternetReachable: boolean | null;
};

/**
 * Whether we should treat the device as online for React Query. A radio can be
 * "connected" to a wifi that has no route out (the classic airport/lounge
 * captive portal), so a *known-false* reachability wins over a connected radio.
 * While reachability is still unknown (null), a connected radio counts as
 * online — optimistic, and corrected the moment the probe resolves.
 */
export function isOnline(state: NetSnapshot): boolean {
  if (state.isConnected !== true) return false;
  return state.isInternetReachable !== false;
}
