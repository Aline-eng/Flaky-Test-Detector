import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

const BEARER_PREFIX = 'Bearer ';

export function requireDashboardToken(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined;

  if (!token || token !== env.DASHBOARD_ACCESS_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
