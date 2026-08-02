import { Router, type Request, type Response } from 'express';
import { findGroupById, listGroups, listStudentsByGroupId } from '../repositories/groups';
import { parseId } from './params';

export const groupsRouter = Router();

groupsRouter.get('/', async (_req: Request, res: Response) => {
  const groups = await listGroups();
  res.json({ count: groups.length, groups });
});

groupsRouter.get('/:id/students', async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'Bad Request', message: 'Group id must be a positive integer' });
    return;
  }

  // Look the group up first: a missing group is a 404, whereas a real group
  // with no students is a 200 with an empty list.
  const group = await findGroupById(id);
  if (group === null) {
    res.status(404).json({ error: 'Not Found', message: `No group with id ${id}` });
    return;
  }

  const students = await listStudentsByGroupId(id);
  res.json({ group, count: students.length, students });
});
