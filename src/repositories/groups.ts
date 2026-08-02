import { query } from '../db';

/**
 * All SQL for study groups lives here.
 *
 * Money columns are cast with `::text` so NUMERIC(10,2) reaches JSON as an
 * exact decimal string ("10.00") instead of a lossy JavaScript float.
 */

export interface GroupSummary {
  id: number;
  name: string;
  session_fee: string;
  tutor_id: number;
  tutor_name: string;
  student_count: number;
}

export interface Group {
  id: number;
  name: string;
  session_fee: string;
  tutor_id: number;
  tutor_name: string;
}

export interface GroupStudent {
  id: number;
  name: string;
  phone: string | null;
}

/**
 * Every group with its tutor and how many students it holds.
 *
 * LEFT JOIN on students so a group with no students still appears, with a
 * count of 0, rather than vanishing from the list.
 */
export async function listGroups(): Promise<GroupSummary[]> {
  const result = await query<GroupSummary>(
    `SELECT g.id,
            g.name,
            g.session_fee::text AS session_fee,
            t.id                AS tutor_id,
            t.name              AS tutor_name,
            COUNT(s.id)::int    AS student_count
       FROM study_groups g
       JOIN tutors t        ON t.id = g.tutor_id
       LEFT JOIN students s ON s.group_id = g.id
      GROUP BY g.id, g.name, g.session_fee, t.id, t.name
      ORDER BY g.id`,
  );
  return result.rows;
}

/** Returns null when no group has this id — the route turns that into a 404. */
export async function findGroupById(id: number): Promise<Group | null> {
  const result = await query<Group>(
    `SELECT g.id,
            g.name,
            g.session_fee::text AS session_fee,
            t.id                AS tutor_id,
            t.name              AS tutor_name
       FROM study_groups g
       JOIN tutors t ON t.id = g.tutor_id
      WHERE g.id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function listStudentsByGroupId(groupId: number): Promise<GroupStudent[]> {
  const result = await query<GroupStudent>(
    `SELECT id, name, phone
       FROM students
      WHERE group_id = $1
      ORDER BY name, id`,
    [groupId],
  );
  return result.rows;
}
