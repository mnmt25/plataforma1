import express from 'express';
import { requireAuth } from '../../core/middleware/session.js';
import {
  obtenerOrigenes,
  obtenerMotivos,
  crearOrigen,
  crearMotivo,
  actualizarOrigen,
  actualizarMotivo,
  eliminarOrigen,
  eliminarMotivo
} from './service.js';

export const catalogosRouter = express.Router();

catalogosRouter.use(requireAuth());

catalogosRouter.get('/origenes', async (req, res, next) => {
  try {
    const origenes = await obtenerOrigenes();
    res.json(origenes);
  } catch (error) {
    next(error);
  }
});

catalogosRouter.post('/origenes', async (req, res, next) => {
  try {
    const result = await crearOrigen(req.user, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

catalogosRouter.put('/origenes/:id', async (req, res, next) => {
  try {
    await actualizarOrigen(req.user, Number(req.params.id), req.body);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

catalogosRouter.delete('/origenes/:id', async (req, res, next) => {
  try {
    await eliminarOrigen(req.user, Number(req.params.id));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

catalogosRouter.get('/motivos', async (req, res, next) => {
  try {
    const motivos = await obtenerMotivos();
    res.json(motivos);
  } catch (error) {
    next(error);
  }
});

catalogosRouter.post('/motivos', async (req, res, next) => {
  try {
    const result = await crearMotivo(req.user, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

catalogosRouter.put('/motivos/:id', async (req, res, next) => {
  try {
    await actualizarMotivo(req.user, Number(req.params.id), req.body);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

catalogosRouter.delete('/motivos/:id', async (req, res, next) => {
  try {
    await eliminarMotivo(req.user, Number(req.params.id));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
