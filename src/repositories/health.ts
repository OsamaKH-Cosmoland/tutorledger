import { query } from '../db';

/** Round-trips a trivial query to prove the database is reachable. */
export async function getDatabaseTime(): Promise<Date | null> {
  const result = await query<{ now: Date }>('SELECT NOW() AS now');
  return result.rows[0]?.now ?? null;
}
