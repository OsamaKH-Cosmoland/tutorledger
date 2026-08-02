import { Router, type Request, type Response } from 'express';
import { findStudentById, listPaymentsByStudentId } from '../repositories/students';
import { parseId } from './params';

export const studentsRouter = Router();

studentsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res
      .status(400)
      .json({ error: 'Bad Request', message: 'Student id must be a positive integer' });
    return;
  }

  const student = await findStudentById(id);
  if (student === null) {
    res.status(404).json({ error: 'Not Found', message: `No student with id ${id}` });
    return;
  }

  const payments = await listPaymentsByStudentId(id);

  res.json({
    id: student.id,
    name: student.name,
    phone: student.phone,
    group: {
      id: student.group_id,
      name: student.group_name,
      session_fee: student.session_fee,
      tutor: { id: student.tutor_id, name: student.tutor_name },
    },
    attendance: {
      sessions_recorded: student.sessions_recorded,
      sessions_present: student.sessions_present,
      sessions_absent: student.sessions_absent,
      attendance_rate:
        student.sessions_recorded === 0
          ? null
          : Number(((student.sessions_present / student.sessions_recorded) * 100).toFixed(1)),
    },
    payments,
    balance: {
      amount_owed: student.amount_owed,
      amount_paid: student.amount_paid,
      outstanding: student.balance,
    },
  });
});
