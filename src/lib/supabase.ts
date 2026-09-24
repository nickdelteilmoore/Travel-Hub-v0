import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { mmkvSupabaseStorage } from "./mmkv";
import { recordStartupError } from "./startup";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Record (don't throw) so a mis-built env surfaces as a visible startup error
// rather than a silent crash before the UI renders. Placeholders keep
// createClient from throwing at import time.
if (!supabaseUrl || !supabaseAnonKey) {
  recordStartupError(
    "Supabase config",
    new Error("Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY"),
  );
}

// Single client for the whole app. The auth session persists to MMKV so it
// survives cold starts.
// detectSessionInUrl is off — auth/callback.tsx exchanges tokens explicitly.
export const supabase = createClient<Database>(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key",
  {
    auth: {
      storage: mmkvSupabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // PKCE returns ?code= (survives Android intents; the #fragment form is
      // often dropped). auth/callback.tsx exchanges the code explicitly.
      flowType: "pkce",
    },
  },
);
