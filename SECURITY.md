# Security

## Reporting a vulnerability

Please report security issues privately through GitHub's
**Security → Report a vulnerability** on this repository, not in a public
issue. Include steps to reproduce and the impact you expect. You'll get an
acknowledgement within a week.

## How the app is secured

Travel Hub is a client for **your own** Supabase project; this repository holds
no keys and points at no live backend.

* **Access is by whitelist, not sign-up.** Every row-level-security policy
  requires `is_household_member()`, which checks the signed-in email against
  `private.allowed_emails`. Turn off public sign-ups as well (see README), but a
  stray sign-up still sees and can write nothing.
* **Owner-scoped data.** Trips, segments, documents, expenses and alerts are
  visible only to their owner. Household members can read each other's
  country entries and profiles, which is what the Schengen count needs, and
  nothing else.
* **No anonymous surface.** The `anon` role has no table grants and cannot
  execute any function.
* **Private storage.** Both buckets are private, size- and MIME-limited, and
  confined per user to a `<uid>/` folder; files are reached through short-lived
  signed URLs.
* **Nothing secret in the bundle.** Only `EXPO_PUBLIC_SUPABASE_URL` and the
  RLS-gated anon key are compiled in. Never put a service-role key in an
  `EXPO_PUBLIC_` variable.
* **Receipts stay on the phone.** Expense capture uses on-device OCR; no
  receipt text or image is sent to a third party.
* **Hardened WebView.** The hotel map escapes embedded values and pins Leaflet
  with subresource integrity. Links from data are opened only if they are
  `http(s)`.

`supabase/tests/rls.sql` exercises these rules against a database; run it
after any policy change (see the file header).
