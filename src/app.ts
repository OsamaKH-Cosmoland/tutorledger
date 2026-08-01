import express, { type Request, type Response } from 'express';
import { query } from './db';

export const app = express();

app.use(express.json());

/** Liveness check — does not touch the database. */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

/** Readiness check — proves the app can actually reach Neon. */
app.get('/health/db', async (_req: Request, res: Response) => {
  try {
    const result = await query<{ now: Date }>('SELECT NOW() AS now');
    res.json({ status: 'ok', databaseTime: result.rows[0]?.now });
  } catch (err) {
    console.error('Database health check failed', err);
    res.status(503).json({ status: 'error', message: 'Cannot reach the database' });
  }
});

export default app;
