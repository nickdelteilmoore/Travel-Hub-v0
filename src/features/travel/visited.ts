/**
 * Which countries count as visited (DESIGN.md, visited countries).
 *
 * Two facts feed the map and the counter, and neither is "has a row in the
 * trip log". A trip marked `transit` is a passage through — a layover keeps
 * its place in the history without colouring the country in — and a country
 * can be visited long before this app existed to log it, which is what the
 * standalone `visited_countries` rows record.
 */
export type VisitCountable = { country_code: string; transit: boolean };

export function visitedCountrySet(
  trips: readonly VisitCountable[],
  standalone: readonly string[] = [],
): Set<string> {
  const visited = new Set<string>();
  for (const trip of trips) {
    if (!trip.transit) visited.add(trip.country_code);
  }
  for (const code of standalone) visited.add(code);
  return visited;
}
