# CLAUDE.md — Travel Hub

## Read first
- DESIGN.md is the source of truth for scope, schema, tokens and contracts.
  Don't invent features, tables or colours that aren't in it.

## Project facts
- Expo dev-client app; Expo Go will NOT run it (native modules).
- Scheme: travelhub:// · Android APK.
- Backend: the user's own Supabase project; access by email whitelist (RLS).

## Commands
- npm install                       # npm, not yarn/pnpm/bun
- npx expo start --dev-client       # dev server
- npm run android                   # build & run locally (needs Android SDK)
- npm run typecheck && npm test     # must stay green
- npx supabase db push              # apply migrations
- npx supabase gen types typescript --linked > src/lib/database.types.ts

## Hard rules
1. TypeScript strict; no `any`, no `@ts-ignore` without a comment explaining why.
2. Never hardcode colours/fonts/spacing — consume src/theme tokens only.
3. Never put secrets in the repo or the app bundle. `.env` stays gitignored;
   only `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` belong in the client.
4. All Supabase access through src/lib/supabase.ts; all server state through
   TanStack Query hooks in src/features/*/queries.ts and mutations.ts.
5. Schema changes = a new file in supabase/migrations/ (never edit old ones) +
   regenerate database.types.ts in the same commit.
6. Every table gets RLS that requires `is_household_member()`; personal rows are
   owner-scoped (`traveller_id = auth.uid()`). Update supabase/tests/rls.sql
   with any policy change and keep it all "ok".
7. Schengen (schengen.ts), visited-countries, reconcile, timezone, expenses and
   hotel-map logic are pure, unit-tested modules. Change them only with tests
   updated to match; screens only render.
8. app/ routes stay thin (≤80 lines); logic lives in src/features/*.
9. Only open http(s) URLs that come from data; escape anything embedded in a
   WebView document.
10. Dates: date-fns, date-only maths for travel; DATE columns for dates,
    timestamptz for instants. UI locale: en-GB (DD Mon).

## Style
- Functional components + hooks only.
- File names: kebab-case for routes (expo-router), camelCase in src/.
- Commits: small, one concern each (feat:/fix:/chore:).
- Comments explain *why*, not *what*.

## Definition of done
- Light AND dark mode checked · offline/loading/empty/error states handled ·
  touch targets ≥48dp · optimistic mutations roll back on failure.
