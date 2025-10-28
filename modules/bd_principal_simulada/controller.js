import express from 'express';
import { requireAuth } from '../../core/middleware/session.js';
import { searchBDP } from './repository.js';

export const bdpRouter = express.Router();
bdpRouter.use(requireAuth());

bdpRouter.get('/', async (req, res, next) => {
  try {
    const { job, id_muestra, analito } = req.query;
    const data = await searchBDP({ job, id_muestra, analito });
    res.json(data);
  } catch (error) {
    next(error);
  }
});
