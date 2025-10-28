import express from 'express';
import { requireAuth } from '../../core/middleware/session.js';
import { exportarSolicitudes } from '../solicitudes/service.js';

export const exportRouter = express.Router();
exportRouter.use(requireAuth());

exportRouter.post('/solicitudes', async (req, res, next) => {
  try {
    const result = await exportarSolicitudes(req.user, req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
});
