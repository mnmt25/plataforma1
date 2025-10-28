import express from 'express';
import { requireAuth } from '../../core/middleware/session.js';
import { queryAudit } from './service.js';

export const auditoriaRouter = express.Router();
auditoriaRouter.use(requireAuth());

auditoriaRouter.get('/', async (req, res, next) => {
  try {
    const { desde, hasta, accion, usuarioId, limit, offset } = req.query;
    const rows = await queryAudit(req.user, {
      desde,
      hasta,
      accion,
      usuarioId,
      limit: limit ? Number(limit) : 200,
      offset: offset ? Number(offset) : 0
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});
