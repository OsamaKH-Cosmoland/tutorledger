import 'dotenv/config';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string.',
  );
}

/**
 * A single shared connection pool for the whole app.
 *
 * Neon requires TLS. `rejectUnauthorized: true` keeps certificate verification
 * on — Neon serves a publicly trusted certificate, so this works as-is and
 * protects against man-in-the-middle connections.
 */
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: true },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

/** Run a parameterised query. Always pass user input via `params`, never string concatenation. */
export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

/** Close the pool — used on graceful shutdown. */
export function closePool(): Promise<void> {
  return pool.end();
}
