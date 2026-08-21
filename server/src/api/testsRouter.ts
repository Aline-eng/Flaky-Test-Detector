import { Router } from 'express';
import { z } from 'zod';
import { requireDashboardToken } from './authMiddleware';
import type { TestsRepository } from './testsRepository';

const overrideSchema = z.object({
  status: z.enum(['STABLE', 'FLAGGED', 'QUARANTINED']),
  reason: z.string().min(1),
});

export function createTestsRouter(repository: TestsRepository): Router {
  const router = Router();
  router.use(requireDashboardToken);

  router.get('/', async (req, res) => {
    const repo = req.query.repo;
    if (typeof repo !== 'string' || repo.length === 0) {
      res.status(400).json({ error: 'repo query parameter is required' });
      return;
    }

    res.json(await repository.listTests(repo));
  });

  router.get('/:id', async (req, res) => {
    const detail = await repository.getTestDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    res.json(detail);
  });

  router.post('/:id/quarantine', async (req, res) => {
    const parsed = overrideSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const found = await repository.recordManualOverride(
      req.params.id,
      parsed.data.status,
      parsed.data.reason,
    );
    if (!found) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    res.status(201).json({ ok: true });
  });

  return router;
}
