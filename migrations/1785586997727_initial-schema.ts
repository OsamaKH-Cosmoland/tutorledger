import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Initial TutorLedger schema.
 *
 * Tables are created parent-first so every foreign key points at a table that
 * already exists: tutors -> study_groups -> students -> {attendance, payments}
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('tutors', {
    id: { type: 'serial', primaryKey: true },
    name: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true, unique: true },
  });

  pgm.createTable('study_groups', {
    id: { type: 'serial', primaryKey: true },
    tutor_id: { type: 'integer', notNull: true, references: 'tutors(id)' },
    name: { type: 'text', notNull: true },
    monthly_fee: { type: 'numeric(10,2)', notNull: true },
  });

  pgm.createTable('students', {
    id: { type: 'serial', primaryKey: true },
    group_id: { type: 'integer', notNull: true, references: 'study_groups(id)' },
    name: { type: 'text', notNull: true },
    phone: { type: 'text' },
  });

  pgm.createTable('attendance', {
    id: { type: 'serial', primaryKey: true },
    student_id: { type: 'integer', notNull: true, references: 'students(id)' },
    date: { type: 'date', notNull: true },
    present: { type: 'boolean', notNull: true },
  });

  pgm.createTable('payments', {
    id: { type: 'serial', primaryKey: true },
    student_id: { type: 'integer', notNull: true, references: 'students(id)' },
    amount: { type: 'numeric(10,2)', notNull: true },
    for_month: { type: 'date', notNull: true },
    paid_at: { type: 'date', notNull: true, default: pgm.func('CURRENT_DATE') },
  });
}

/** Drop in reverse order so no table is removed while another still references it. */
export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('payments');
  pgm.dropTable('attendance');
  pgm.dropTable('students');
  pgm.dropTable('study_groups');
  pgm.dropTable('tutors');
}
