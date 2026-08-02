import { query } from '../db';

/**
 * All SQL for students, their attendance summary, payments and balance.
 *
 * Two conventions used throughout:
 *
 * - Money (NUMERIC) and DATE columns are cast with `::text`. Money keeps its
 *   exact decimal string; dates stay 'YYYY-MM-DD' instead of becoming JS Date
 *   objects, which JSON.stringify would convert to UTC timestamps and could
 *   shift by a day depending on the server's timezone.
 *
 * - attendance and payments are each aggregated in their own subquery that
 *   emits ONE row per student before being joined. Joining both one-to-many
 *   tables straight onto students would multiply every payment by the number
 *   of attendance rows, wildly inflating totals.
 */

export interface StudentSummary {
  id: number;
  name: string;
  phone: string | null;
  group_id: number;
  group_name: string;
  session_fee: string;
  tutor_id: number;
  tutor_name: string;
  sessions_recorded: number;
  sessions_present: number;
  sessions_absent: number;
  amount_owed: string;
  amount_paid: string;
  balance: string;
}

export interface Payment {
  id: number;
  amount: string;
  for_month: string;
  paid_at: string;
}

export interface UnpaidStudent {
  id: number;
  name: string;
  group_id: number;
  group_name: string;
  session_fee: string;
  sessions_present: number;
  amount_owed: string;
  amount_paid: string;
  balance: string;
}

/**
 * One student with attendance counts and balance.
 * Returns null when the id matches nothing, so the route can send a 404.
 */
export async function findStudentById(id: number): Promise<StudentSummary | null> {
  const result = await query<StudentSummary>(
    `SELECT s.id,
            s.name,
            s.phone,
            g.id                AS group_id,
            g.name              AS group_name,
            g.session_fee::text AS session_fee,
            t.id                AS tutor_id,
            t.name              AS tutor_name,
            COALESCE(a.recorded, 0)::int                     AS sessions_recorded,
            COALESCE(a.present_count, 0)::int                AS sessions_present,
            (COALESCE(a.recorded, 0) - COALESCE(a.present_count, 0))::int
                                                             AS sessions_absent,
            (COALESCE(a.present_count, 0) * g.session_fee)::numeric(10,2)::text
                                                             AS amount_owed,
            COALESCE(p.total_paid, 0)::numeric(10,2)::text   AS amount_paid,
            ((COALESCE(a.present_count, 0) * g.session_fee)
              - COALESCE(p.total_paid, 0))::numeric(10,2)::text  AS balance
       FROM students s
       JOIN study_groups g ON g.id = s.group_id
       JOIN tutors t       ON t.id = g.tutor_id
       LEFT JOIN (
              SELECT student_id,
                     COUNT(*)                        AS recorded,
                     COUNT(*) FILTER (WHERE present) AS present_count
                FROM attendance
               WHERE student_id = $1
               GROUP BY student_id
            ) a ON a.student_id = s.id
       LEFT JOIN (
              SELECT student_id,
                     SUM(amount) AS total_paid
                FROM payments
               WHERE student_id = $1
               GROUP BY student_id
            ) p ON p.student_id = s.id
      WHERE s.id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function listPaymentsByStudentId(studentId: number): Promise<Payment[]> {
  const result = await query<Payment>(
    `SELECT id,
            amount::text    AS amount,
            for_month::text AS for_month,
            paid_at::text   AS paid_at
       FROM payments
      WHERE student_id = $1
      ORDER BY for_month, paid_at, id`,
    [studentId],
  );
  return result.rows;
}

/**
 * Students whose balance is still above zero.
 *
 * Both aggregates are pre-collapsed to one row per student. A student with no
 * payment rows survives the LEFT JOIN and owes the full amount via COALESCE,
 * and a student who paid in two instalments has those instalments summed once
 * rather than multiplied by their ~40 attendance rows.
 */
export async function listUnpaidStudents(): Promise<UnpaidStudent[]> {
  const result = await query<UnpaidStudent>(
    `SELECT s.id,
            s.name,
            g.id                AS group_id,
            g.name              AS group_name,
            g.session_fee::text AS session_fee,
            COALESCE(a.present_count, 0)::int                AS sessions_present,
            (COALESCE(a.present_count, 0) * g.session_fee)::numeric(10,2)::text
                                                             AS amount_owed,
            COALESCE(p.total_paid, 0)::numeric(10,2)::text   AS amount_paid,
            ((COALESCE(a.present_count, 0) * g.session_fee)
              - COALESCE(p.total_paid, 0))::numeric(10,2)::text  AS balance
       FROM students s
       JOIN study_groups g ON g.id = s.group_id
       LEFT JOIN (
              SELECT student_id,
                     COUNT(*) FILTER (WHERE present) AS present_count
                FROM attendance
               GROUP BY student_id
            ) a ON a.student_id = s.id
       LEFT JOIN (
              SELECT student_id,
                     SUM(amount) AS total_paid
                FROM payments
               GROUP BY student_id
            ) p ON p.student_id = s.id
      WHERE (COALESCE(a.present_count, 0) * g.session_fee)
              - COALESCE(p.total_paid, 0) > 0
      ORDER BY ((COALESCE(a.present_count, 0) * g.session_fee)
                 - COALESCE(p.total_paid, 0)) DESC, s.name`,
  );
  return result.rows;
}
