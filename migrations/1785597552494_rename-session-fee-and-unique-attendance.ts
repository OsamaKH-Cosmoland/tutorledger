import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * 1. Rename study_groups.monthly_fee -> session_fee.
 * 2. Enforce one attendance row per student per day.
 *
 * Deliberately NOT touching payments: a student may pay for one month in
 * several instalments, so (student_id, for_month) must stay non-unique.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.renameColumn('study_groups', 'monthly_fee', 'session_fee');

  pgm.createIndex('attendance', ['student_id', 'date'], {
    name: 'attendance_student_id_date_unique',
    unique: true,
  });
}

/** Exact inverse of up(), applied in reverse order. */
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('attendance', ['student_id', 'date'], {
    name: 'attendance_student_id_date_unique',
  });

  pgm.renameColumn('study_groups', 'session_fee', 'monthly_fee');
}
