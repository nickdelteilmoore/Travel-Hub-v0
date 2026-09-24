import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import type { Tables } from "@/lib/database.types";

type Profile = Tables<"profiles">;

type AuthValue = {
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  /** True until the persisted session has been restored on cold start. */
  initialising: boolean;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initialising, setInitialising] = useState(true);

  useEffect(() => {
    // Restore the MMKV-persisted session before first paint.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitialising(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  // Every server read is RLS-scoped to auth.uid(), so a query run before the
  // session is restored (screens fetch on first paint, ahead of the auth
  // gate's redirect) comes back empty and — because the cache is persisted —
  // stays empty after sign-in. Reset the cache whenever the signed-in identity
  // actually changes so those reads refetch for whoever is signed in now, and
  // one account's rows never linger for the next. The first run (cold-start
  // restore) is skipped: a restored session already fetches authenticated.
  const lastUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (lastUserIdRef.current === undefined) {
      lastUserIdRef.current = userId;
      return;
    }
    if (lastUserIdRef.current !== userId) {
      lastUserIdRef.current = userId;
      void queryClient.resetQueries();
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let active = true;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setProfile(data ?? null);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const value = useMemo<AuthValue>(
    () => ({ session, userId, profile, initialising }),
    [session, userId, profile, initialising],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
