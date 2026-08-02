import { Router, type Request, type Response } from 'express';

export const rootRouter = Router();

/** Service index — lists what this API exposes. */
rootRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'TutorLedger API',
    endpoints: [
      { method: 'GET', path: '/', description: 'This index' },
      { method: 'GET', path: '/health', description: 'Liveness check' },
      { method: 'GET', path: '/health/db', description: 'Database connectivity check' },
      { method: 'GET', path: '/api/groups', description: 'All study groups with tutor and student count' },
      { method: 'GET', path: '/api/groups/:id/students', description: 'Students in one group' },
      { method: 'GET', path: '/api/students/:id', description: 'One student with attendance, payments and balance' },
      { method: 'GET', path: '/api/unpaid', description: 'Students who still owe money' },
    ],
  });
});
