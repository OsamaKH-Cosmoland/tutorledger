/**
 * Development seed script — `npm run seed`.
 *
 * DESTRUCTIVE: truncates all five tables, then regenerates a full dataset.
 * Safe to run repeatedly; every run produces the same data because the random
 * number generator is seeded with a fixed constant.
 */
import type { PoolClient } from 'pg';
import { pool } from './db';

// ---------------------------------------------------------------- config

const SESSION_FEE = 10; // dollars per session attended
const GROUP_COUNT = 3;
const STUDENTS_PER_GROUP = 20;
const SESSIONS = 40; // weekdays, spread across two months
const FIRST_SESSION = '2026-06-01'; // a Monday
const RNG_SEED = 20260801;

/** Deterministic PRNG (mulberry32) so re-running produces identical data. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(RNG_SEED);
const randInt = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;

// ---------------------------------------------------------------- names

const TUTORS = [
  { name: 'Layla Haddad', email: 'layla.haddad@tutorledger.test' },
  { name: 'Omar Nasser', email: 'omar.nasser@tutorledger.test' },
  { name: 'Farida Mansour', email: 'farida.mansour@tutorledger.test' },
] as const;

const GROUP_NAMES = ['Algebra II — Evening', 'Physics Foundations', 'English Literature'] as const;

const FIRST_NAMES = [
  'Adam', 'Amina', 'Bilal', 'Carla', 'Dalia', 'Daniel', 'Elias', 'Emma', 'Fatima', 'Gabriel',
  'Hana', 'Hassan', 'Ibrahim', 'Ines', 'Jamal', 'Julia', 'Karim', 'Leila', 'Lucas', 'Maha',
  'Malak', 'Marco', 'Mariam', 'Nadia', 'Nour', 'Omar', 'Rami', 'Rana', 'Rayan', 'Sami',
  'Sara', 'Selim', 'Sofia', 'Tarek', 'Thomas', 'Yara', 'Yasmin', 'Youssef', 'Zainab', 'Ziad',
] as const;

const LAST_NAMES = [
  'Abboud', 'Aziz', 'Barakat', 'Chahine', 'Darwish', 'El-Amin', 'Fahmy', 'Ghanem', 'Halabi',
  'Ibrahim', 'Jaber', 'Kassab', 'Khoury', 'Mansour', 'Nakhle', 'Osman', 'Rahal', 'Saad',
  'Sleiman', 'Tannous', 'Wahba', 'Yousef', 'Zahra', 'Zeidan',
] as const;

/** Build `count` distinct "First Last" names. */
function uniqueNames(count: number): string[] {
  const seen = new Set<string>();
  while (seen.size < count) {
    seen.add(`${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`);
  }
  return [...seen];
}

/** 70% of students have a phone on file; the rest are NULL. */
function maybePhone(): string | null {
  if (rand() > 0.7) return null;
  return `+20 10 ${randInt(1000, 9999)} ${randInt(1000, 9999)}`;
}

// ---------------------------------------------------------------- dates

/** The next `count` weekdays (Mon–Fri) starting at `startIso`, as YYYY-MM-DD. */
function sessionDates(startIso: string, count: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startIso}T00:00:00Z`);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

const monthOf = (isoDate: string): string => `${isoDate.slice(0, 7)}-01`;

// ---------------------------------------------------------------- db helpers

/**
 * Multi-row INSERT in chunks — one round trip per chunk instead of per row,
 * which matters over a remote Neon connection.
 *
 * `table` and `columns` are module-level constants, never user input; every
 * value is still passed as a bound parameter.
 */
async function bulkInsert(
  client: PoolClient,
  table: string,
  columns: readonly string[],
  rows: readonly unknown[][],
  chunkSize = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const params: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = row.map((value) => {
        params.push(value);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`,
      params,
    );
  }
}

// ---------------------------------------------------------------- seeding

type PaymentBehavior = 'paid_in_full' | 'two_instalments' | 'unpaid';

function paymentBehavior(): PaymentBehavior {
  const roll = rand();
  if (roll < 0.5) return 'paid_in_full';
  if (roll < 0.8) return 'two_instalments';
  return 'unpaid';
}

async function seed(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Wipe everything. RESTART IDENTITY resets the SERIAL sequences so ids
    //    start at 1 again; CASCADE handles the foreign-key ordering for us.
    await client.query(
      'TRUNCATE attendance, payments, students, study_groups, tutors RESTART IDENTITY CASCADE',
    );

    // 2. Tutors
    const tutorRows = await client.query<{ id: number }>(
      `INSERT INTO tutors (name, email) VALUES ($1,$2), ($3,$4), ($5,$6) RETURNING id`,
      TUTORS.flatMap((t) => [t.name, t.email]),
    );
    const tutorIds = tutorRows.rows.map((r) => r.id);

    // 3. One study group per tutor
    const groupRows = await client.query<{ id: number }>(
      `INSERT INTO study_groups (tutor_id, name, session_fee)
       VALUES ($1,$2,$3), ($4,$5,$6), ($7,$8,$9) RETURNING id`,
      tutorIds.flatMap((tutorId, i) => [tutorId, GROUP_NAMES[i]!, SESSION_FEE.toFixed(2)]),
    );
    const groupIds = groupRows.rows.map((r) => r.id);

    // 4. Students, 20 per group
    const names = uniqueNames(GROUP_COUNT * STUDENTS_PER_GROUP);
    const studentRows: unknown[][] = [];
    let nameIndex = 0;
    for (const groupId of groupIds) {
      for (let i = 0; i < STUDENTS_PER_GROUP; i++) {
        studentRows.push([groupId, names[nameIndex++]!, maybePhone()]);
      }
    }
    await bulkInsert(client, 'students', ['group_id', 'name', 'phone'], studentRows);

    // Read the ids back rather than trusting RETURNING order.
    const students = await client.query<{ id: number }>('SELECT id FROM students ORDER BY id');
    const studentIds = students.rows.map((r) => r.id);

    // 5. Attendance — every student, every session.
    //    Each student gets a personal attendance rate so some are more reliable
    //    than others; the rates average out to roughly 80% overall.
    const dates = sessionDates(FIRST_SESSION, SESSIONS);
    const attendanceRows: unknown[][] = [];
    const presentByStudentMonth = new Map<string, number>();

    for (const studentId of studentIds) {
      const personalRate = 0.65 + rand() * 0.3; // 65%–95%, mean ~80%
      for (const date of dates) {
        const present = rand() < personalRate;
        attendanceRows.push([studentId, date, present]);
        if (present) {
          const key = `${studentId}|${monthOf(date)}`;
          presentByStudentMonth.set(key, (presentByStudentMonth.get(key) ?? 0) + 1);
        }
      }
    }
    await bulkInsert(client, 'attendance', ['student_id', 'date', 'present'], attendanceRows);

    // 6. Payments — owed is driven by attendance, never random.
    //    Amounts are whole dollars because fee x sessions is always whole.
    const paymentRows: unknown[][] = [];
    const behaviorTally: Record<PaymentBehavior, number> = {
      paid_in_full: 0,
      two_instalments: 0,
      unpaid: 0,
    };
    const months = [...new Set(dates.map(monthOf))];

    for (const studentId of studentIds) {
      const behavior = paymentBehavior();
      behaviorTally[behavior]++;
      if (behavior === 'unpaid') continue;

      for (const month of months) {
        const attended = presentByStudentMonth.get(`${studentId}|${month}`) ?? 0;
        const owed = attended * SESSION_FEE;
        if (owed === 0) continue;

        const monthPrefix = month.slice(0, 7);
        if (behavior === 'paid_in_full') {
          const paidAt = `${monthPrefix}-${String(randInt(3, 15)).padStart(2, '0')}`;
          paymentRows.push([studentId, owed.toFixed(2), month, paidAt]);
        } else {
          const first = Math.floor(owed / 2);
          const second = owed - first; // the two always sum back to owed
          paymentRows.push([
            studentId,
            first.toFixed(2),
            month,
            `${monthPrefix}-${String(randInt(2, 9)).padStart(2, '0')}`,
          ]);
          paymentRows.push([
            studentId,
            second.toFixed(2),
            month,
            `${monthPrefix}-${String(randInt(16, 27)).padStart(2, '0')}`,
          ]);
        }
      }
    }
    await bulkInsert(
      client,
      'payments',
      ['student_id', 'amount', 'for_month', 'paid_at'],
      paymentRows,
    );

    await client.query('COMMIT');

    const presentTotal = attendanceRows.filter((r) => r[2] === true).length;
    console.log('Seed complete:');
    console.log(`  tutors        ${tutorIds.length}`);
    console.log(`  study_groups  ${groupIds.length}`);
    console.log(`  students      ${studentIds.length}`);
    console.log(
      `  attendance    ${attendanceRows.length} rows over ${dates.length} sessions ` +
        `(${dates[0]} to ${dates.at(-1)}), ${((presentTotal / attendanceRows.length) * 100).toFixed(1)}% present`,
    );
    console.log(
      `  payments      ${paymentRows.length} rows ` +
        `(${behaviorTally.paid_in_full} paid in full, ${behaviorTally.two_instalments} in two ` +
        `instalments, ${behaviorTally.unpaid} unpaid)`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Guard against pointing this at anything but a development database.
if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== '1') {
  console.error('Refusing to seed with NODE_ENV=production. Set SEED_FORCE=1 to override.');
  process.exit(1);
}

seed()
  .then(() => pool.end())
  .catch(async (error: unknown) => {
    console.error('Seed failed:', error);
    await pool.end();
    process.exit(1);
  });
