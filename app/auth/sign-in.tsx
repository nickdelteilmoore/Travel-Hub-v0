import { useRef, useState } from "react";
import { TextInput, View } from "react-native";

import { Screen, Text, Button, TextField } from "@/components/ui";
import { supabase } from "@/lib/supabase";

// A classic email + password sign-in. Accounts are pre-created in your
// Supabase project (see README), so this only ever signs in — it never creates
// an account — and the whitelist + RLS rules do the rest. On success the auth
// listener updates the session and the root gate redirects into the app.
export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    const creds = { email: email.trim().toLowerCase(), password };
    if (!creds.email || !creds.password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword(creds);
    setLoading(false);
    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Wrong email or password."
          : signInError.message,
      );
    }
  }

  return (
    <Screen padded>
      <View style={{ flex: 1, justifyContent: "center", gap: 32 }}>
        <View style={{ gap: 8 }}>
          <Text variant="display">Travel Hub 🧳</Text>
          <Text variant="body" color="textMuted">
            Sign in
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!loading}
          />
          <TextField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!loading}
          />
          <Button
            label="Sign in"
            variant="primary"
            loading={loading}
            disabled={loading}
            onPress={submit}
            fullWidth
          />
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
