/**
 * Parses a route parameter that must be a positive integer id.
 * Returns null for anything else ("abc", "-1", "1.5", "") so the route can
 * reject it before the value ever reaches Postgres.
 */
export function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) return null;
  return value;
}
