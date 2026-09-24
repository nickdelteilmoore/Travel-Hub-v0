import { isOnline } from "./netStatus";

describe("isOnline", () => {
  it("is online when connected and reachable", () => {
    expect(isOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
  });

  it("is online when connected and reachability is still unknown", () => {
    // NetInfo emits isInternetReachable: null before the probe resolves; a
    // connected radio should paint as online rather than flashing offline.
    expect(isOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
  });

  it("is offline on a connected radio with no route out (captive wifi)", () => {
    expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it("is offline with no connection", () => {
    expect(isOnline({ isConnected: false, isInternetReachable: false })).toBe(false);
    expect(isOnline({ isConnected: null, isInternetReachable: null })).toBe(false);
  });
});
