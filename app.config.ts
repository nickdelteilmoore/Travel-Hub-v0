import type { ExpoConfig } from "expo/config";

// Botanical brand grounds — kept in sync with theme tokens. Splash and
// adaptive-icon background both sit on the Leaf-primary olive ground.
const FOREST = "#55632E"; // Leaf Primary

const config: ExpoConfig = {
  name: "Travel Hub",
  slug: "travel-hub",
  scheme: "travelhub",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic", // adaptive light/dark — REQUIRED
  newArchEnabled: true, // required by react-native-mmkv v3 and reanimated v4
  // The leaf mark in Cream Linen on the Leaf-primary olive ground.
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: FOREST,
  },
  assetBundlePatterns: ["**/*"],
  android: {
    // Change this to a reverse-domain id you own before publishing a build.
    package: "com.example.travelhub",
    adaptiveIcon: {
      foregroundImage: "./assets/icon-leaf-foreground.png",
      backgroundColor: FOREST,
    },
  },
  plugins: [
    "expo-router",
    "expo-font",
    [
      "expo-image-picker",
      {
        cameraPermission: "Travel Hub uses the camera so you can photograph a receipt to log an expense.",
        photosPermission: "Travel Hub needs photo access so you can attach a receipt image to an expense.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    // `eas init` writes your own EAS project id here on first cloud build.
  },
};

export default config;
