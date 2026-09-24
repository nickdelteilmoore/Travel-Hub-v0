import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

import { mmkvAsyncStorage } from "./mmkv";
import { registerTravelMutationDefaults } from "@/features/travel/mutations";

// Cache aggressively and persist to MMKV so screens paint instantly offline
//. Travel/expense writes go further: they run offline by
// pausing until reconnect (see `registerTravelMutationDefaults`), and both the
// query cache and the paused mutations are persisted, so an edit made on a
// plane survives a cold start and syncs on landing.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24, // keep persisted cache for a day
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Register once, at module load — before the persister rehydrates — so a
// mutation dehydrated while paused on a previous launch finds its function and
// its optimistic/rollback handlers here and can resume.
registerTravelMutationDefaults(queryClient);

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: mmkvAsyncStorage,
  key: "travelhub.query-cache",
  throttleTime: 1000,
});
