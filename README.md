# TutorLedger

An Express + TypeScript API for tracking tutors, study groups, students, attendance and monthly
payments, backed by Postgres on [Neon](https://neon.tech). Schema changes are managed with
[node-pg-migrate](https://github.com/salsita/node-pg-migrate).

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Put your Neon connection string in `.env`:

   ```
   DATABASE_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
   ```

   `.env` is git-ignored. `.env.example` is the committed template.

   > `pg` prints a warning that `sslmode=require` is currently treated as `verify-full` and will
   > change meaning in pg v9. `src/db.ts` already pins the secure behaviour explicitly
   > (`ssl: { rejectUnauthorized: true }`), so the connection is verified either way. To silence
   > the warning, change `sslmode=require` to `sslmode=verify-full` in your connection string.

3. Create the tables:

   ```bash
   npm run migrate:up
   ```

4. Run the API:

   ```bash
   npm run dev
   ```

   Then check `http://localhost:3000/health` and `http://localhost:3000/health/db`.

## Scripts

| Script                   | What it does                                                  |
| ------------------------ | ------------------------------------------------------------- |
| `npm run dev`            | Start the server with hot reload (via `tsx watch`)             |
| `npm run build`          | Compile `src/` to `dist/`                                      |
| `npm start`              | Run the compiled server from `dist/`                           |
| `npm run typecheck`      | Type-check `src/` and `migrations/` without emitting           |
| `npm run migrate:up`     | Apply all pending migrations                                   |
| `npm run migrate:down`   | Roll back the most recent migration                            |
| `npm run migrate:create` | Scaffold a new timestamped `.ts` migration                     |

## Schema

```
tutors ──< study_groups ──< students ──< attendance
                                     └─< payments
```

- **tutors** — the people teaching.
- **study_groups** — a class owned by one tutor, with a `session_fee`.
- **students** — belongs to exactly one study group.
- **attendance** — one row per student per date, `present` true/false.
- **payments** — money received from a student, tagged with the month it covers (`for_month`).

## Migrations

Migrations live in `migrations/` as timestamped TypeScript files. Each exports `up()` (apply) and
`down()` (roll back). node-pg-migrate records applied migrations in a `pgmigrations` table, so
running `migrate:up` twice is safe — it only runs what is pending.

Never edit a migration that has already run on a database you care about. Create a new one instead:

```bash
npm run migrate:create -- add-something
```
