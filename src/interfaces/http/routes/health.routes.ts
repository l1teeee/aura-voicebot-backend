import { Request, Response, Router } from 'express';
import { HEALTH_STATUS_OK, HTTP_STATUS } from '../constants';

const HEALTH_ROUTE_PATH = '/';

export const createHealthRouter = (): Router => {
  const router = Router();

  router.get(HEALTH_ROUTE_PATH, (_req: Request, res: Response): void => {
    res.status(HTTP_STATUS.ok).json({
      status: HEALTH_STATUS_OK,
      uptime: Math.floor(process.uptime())
    });
  });

  return router;
};
