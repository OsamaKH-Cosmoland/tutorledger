import express, { type NextFunction, type Request, type Response } from 'express';
import { getDatabaseTime } from './repositories/health';
import { groupsRouter } from './routes/groups';
import { rootRouter } from './routes/root';
import { studentsRouter } from './routes/students';
import { unpaidRouter } from './routes/unpaid';

export const app = express();

app.use(express.json());

app.use('/', rootRouter);

/** Liveness check — does not touch the database. */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

/** Readiness check — proves the app can actually reach Neon. */
app.get('/health/db', async (_req: Request, res: Response) => {
  try {
    const databaseTime = await getDatabaseTime();
    res.json({ status: 'ok', databaseTime });
  } catch (err) {
    console.error('Database health check failed', err);
    res.status(503).json({ status: 'error', message: 'Cannot reach the database' });
  }
});

app.use('/api/groups', groupsRouter);
app.use('/api/students', studentsRouter);
app.use('/api/unpaid', unpaidRouter);

/** Unknown path — answer in JSON rather than Express's default HTML. */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

/**
 * Final error handler. Express 5 forwards rejected promises from async route
 * handlers here automatically, so repository failures surface as a 500 instead
 * of hanging the request.
 */
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
