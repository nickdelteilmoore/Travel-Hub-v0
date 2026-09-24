import "react-native-reanimated";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Stack, useRouter, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import {
  AlbertSans_600SemiBold,
  AlbertSans_700Bold,
} from "@expo-google-fonts/albert-sans";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { ThemeProvider } from "@/theme/ThemeProvider";
import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import { queryClient, asyncStoragePersister } from "@/lib/queryClient";
import { setupConnectivity } from "@/lib/connectivity";
import { SnackbarHost } from "@/components/ui";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ErrorBoundary, StartupErrorScreen } from "@/components/ErrorBoundary";
import { startupErrors } from "@/lib/startup";

SplashScreen.preventAutoHideAsync();

// Teach React Query about connectivity once, at module load, so the online
// state is right before the first screen mounts.
setupConnectivity();

// Redirect based on session. No session → /auth; session on an auth
// screen → home.
function AuthGate() {
  const { session, initialising } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initialising) return;
    const inAuthGroup = segments[0] === "auth";
    if (!session && !inAuthGroup) router.replace("/auth/sign-in");
    else if (session && inAuthGroup) router.replace("/");
  }, [session, initialising, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { flex: 1 } }}>
      <Stack.Screen name="travel/entry" options={{ presentation: "modal" }} />
      <Stack.Screen name="travel/segment-entry" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Design-system faces via @expo-google-fonts. Two families: Albert Sans
    // (display + UI) and Inter (body + numbers).
    AlbertSans_600SemiBold,
    AlbertSans_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Bundled copies of the same faces, addressable by file name.
    "AlbertSans-SemiBold": require("../assets/fonts/AlbertSans-SemiBold.ttf"),
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || startupErrors.length > 0) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Surface any early module-load failure instead of a silent crash.
  if (startupErrors.length > 0) return <StartupErrorScreen errors={startupErrors} />;

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: asyncStoragePersister }}
            // Once the cache rehydrates, replay any writes that were queued
            // offline on a previous launch.
            onSuccess={() => {
              queryClient.resumePausedMutations();
            }}
          >
            <ThemeProvider>
              <AuthProvider>
                <StatusBar style="auto" />
                <AuthGate />
                <OfflineBanner />
                <SnackbarHost />
              </AuthProvider>
            </ThemeProvider>
          </PersistQueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
