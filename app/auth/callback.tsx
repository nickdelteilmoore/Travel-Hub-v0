import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";

import { Screen, Text, Button } from "@/components/ui";
import { supabase } from "@/lib/supabase";

// Pull implicit-flow tokens out of the URL fragment (#access_token=…).
function fragmentTokens(url: string) {
  const fragment = url.split("#")[1] ?? "";
  const fp = new URLSearchParams(fragment);
  return {
    access_token: fp.get("access_token") ?? undefined,
    refresh_token: fp.get("refresh_token") ?? undefined,
    error_description: fp.get("error_description") ?? undefined,
  };
}

function codeFromUrl(url: string): string | undefined {
  const query = url.includes("?") ? (url.split("?")[1]?.split("#")[0] ?? "") : "";
  return new URLSearchParams(query).get("code") ?? undefined;
}

// Handles travelhub://auth/callback?code=… (PKCE) and #access_token=… (implicit),
// including the cold-start case where the launch URL isn't in useURL() yet.
export default function CallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const hookUrl = Linking.useURL();
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      if (done.current) return;

      const url = hookUrl ?? (await Linking.getInitialURL());
      const frag = url ? fragmentTokens(url) : { access_token: undefined, refresh_token: undefined, error_description: undefined };
      const code = params.code ?? (url ? codeFromUrl(url) : undefined);
      const errDesc = params.error_description ?? frag.error_description;

      if (errDesc) {
        if (!cancelled) setError(errDesc);
        return;
      }

      try {
        if (code) {
          done.current = true;
          const { error: e } = await supabase.auth.exchangeCodeForSession(code);
          if (e) throw e;
        } else if (frag.access_token && frag.refresh_token) {
          done.current = true;
          const { error: e } = await supabase.auth.setSession({
            access_token: frag.access_token,
            refresh_token: frag.refresh_token,
          });
          if (e) throw e;
        } else {
          return; // no usable credentials yet — wait for the launch URL
        }
        if (!cancelled) router.replace("/");
      } catch (e) {
        done.current = false;
        if (!cancelled) setError(e instanceof Error ? e.message : "Sign-in failed.");
      }
    }

    complete();
    return () => {
      cancelled = true;
    };
  }, [hookUrl, params.code, params.error_description, router]);

  // Never hang silently: offer a way out if nothing resolves.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!done.current) {
        setError((prev) => prev ?? "That link didn't complete. Request a new one.");
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Screen padded>
      <View style={{ flex: 1, justifyContent: "center", gap: 16 }}>
        <Text variant="title">{error ? "Couldn't sign in" : "Signing you in…"}</Text>
        {error ? (
          <>
            <Text variant="body" color="textMuted">
              {error}
            </Text>
            <Button label="Back to sign in" onPress={() => router.replace("/auth/sign-in")} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}
