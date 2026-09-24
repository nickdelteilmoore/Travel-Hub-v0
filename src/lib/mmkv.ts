import { MMKV } from "react-native-mmkv";

import { recordStartupError } from "./startup";

// Minimal surface the app uses — lets us swap in an in-memory fallback if the
// native MMKV module fails to initialise (which would otherwise crash the app
// at launch, before any UI renders).
export type KVStore = {
  getString(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
  set(key: string, value: string | number | boolean): void;
  delete(key: string): void;
  contains(key: string): boolean;
};

function createStore(): KVStore {
  try {
    return new MMKV({ id: "travelhub.app" });
  } catch (error) {
    // Degrade instead of hard-crashing; the root layout surfaces the error.
    recordStartupError("MMKV init", error);
    const mem = new Map<string, string | number | boolean>();
    return {
      getString: (k) => (typeof mem.get(k) === "string" ? (mem.get(k) as string) : undefined),
      getNumber: (k) => (typeof mem.get(k) === "number" ? (mem.get(k) as number) : undefined),
      getBoolean: (k) => (typeof mem.get(k) === "boolean" ? (mem.get(k) as boolean) : undefined),
      set: (k, v) => void mem.set(k, v),
      delete: (k) => void mem.delete(k),
      contains: (k) => mem.has(k),
    };
  }
}

// Single app-wide store with synchronous reads/writes.
export const storage: KVStore = createStore();

// Supabase auth-storage adapter.
export const mmkvSupabaseStorage = {
  getItem: (key: string): string | null => storage.getString(key) ?? null,
  setItem: (key: string, value: string): void => storage.set(key, value),
  removeItem: (key: string): void => storage.delete(key),
};

// Zustand persist storage adapter (StateStorage shape).
export const mmkvZustandStorage = {
  getItem: (name: string): string | null => storage.getString(name) ?? null,
  setItem: (name: string, value: string): void => storage.set(name, value),
  removeItem: (name: string): void => storage.delete(name),
};

// AsyncStorage-like adapter (promise-based) for the TanStack Query persister.
export const mmkvAsyncStorage = {
  getItem: async (key: string): Promise<string | null> =>
    storage.getString(key) ?? null,
  setItem: async (key: string, value: string): Promise<void> =>
    storage.set(key, value),
  removeItem: async (key: string): Promise<void> => storage.delete(key),
};
