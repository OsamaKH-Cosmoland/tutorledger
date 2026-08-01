import { app } from './app';
import { closePool } from './db';

const port = Number(process.env.PORT ?? 3000);

const server = app.listen(port, () => {
  console.log(`TutorLedger API listening on http://localhost:${port}`);
});

/** Close HTTP connections and the Postgres pool cleanly on Ctrl+C / container stop. */
async function shutdown(signal: string): Promise<void> {
  console.log(`\nReceived ${signal}, shutting down...`);
  server.close();
  await closePool();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
