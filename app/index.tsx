import { Redirect } from "expo-router";

// Travel Hub is a single-purpose app: there is no launcher deck to land on, so
// the root sends straight to the hub. The AuthGate in _layout.tsx has already
// bounced an unauthenticated visitor to /auth/sign-in before this renders.
export default function Index() {
  return <Redirect href="/travel" />;
}
