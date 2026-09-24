/**
 * Greeting names derived from `profiles.display_name`.
 *
 * Supabase seeds display_name from the email local part when a user signs up
 * without metadata, so rows can read "jane.q.traveller". These helpers keep
 * the UI correct for any row that arrives with an unhelpful name.
 */

/** First name for greetings and traveler switchers. */
export function firstNameFrom(
  displayName: string | null | undefined,
  fallback = "there",
): string {
  const trimmed = (displayName ?? "").trim();
  if (!trimmed) return fallback;

  // A single token carrying dots/underscores is an email local part, not a
  // name — "jane.q.traveller" should greet as "Jane". Multi-word values are
  // real names, so hyphens inside them stay put ("Anne-Marie").
  const separator = /\s/.test(trimmed) ? /\s+/ : /[._]+/;
  const first = trimmed.split(separator)[0];
  if (!first) return fallback;

  // Leave anything already capitalised alone — "McKenzie", "O'Brien".
  return /[A-Z]/.test(first)
    ? first
    : first.charAt(0).toUpperCase() + first.slice(1);
}
