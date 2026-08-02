import { Router, type Request, type Response } from 'express';
import { listUnpaidStudents } from '../repositories/students';

export const unpaidRouter = Router();

unpaidRouter.get('/', async (_req: Request, res: Response) => {
  const students = await listUnpaidStudents();

  // Sum the outstanding balances as integer cents so repeated float addition
  // cannot drift the total.
  const totalCents = students.reduce(
    (sum, student) => sum + Math.round(Number(student.balance) * 100),
    0,
  );

  res.json({
    count: students.length,
    total_outstanding: (totalCents / 100).toFixed(2),
    students,
  });
});
