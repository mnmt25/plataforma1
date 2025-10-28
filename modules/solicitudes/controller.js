import express from 'express';
import { requireAuth } from '../../core/middleware/session.js';
import {
  listarSolicitudes,
  obtenerSolicitudDetalle,
  crearSolicitud,
  actualizarSolicitud,
  cambiarEstado,
  dashboardData
} from './service.js';

export const solicitudesRouter = express.Router();
solicitudesRouter.use(requireAuth());

solicitudesRouter.get('/', async (req, res, next) => {
  try {
    const data = await listarSolicitudes(req.user, req.query);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

solicitudesRouter.get('/dashboard/resumen', async (req, res, next) => {
  try {
    const data = await dashboardData(req.user, req.query);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

solicitudesRouter.get('/:id', async (req, res, next) => {
  try {
    const solicitud = await obtenerSolicitudDetalle(req.user, Number(req.params.id));
    res.json(solicitud);
  } catch (error) {
    next(error);
  }
});

solicitudesRouter.post('/', async (req, res, next) => {
  try {
    const solicitud = await crearSolicitud(req.user, req.body);
    res.status(201).json(solicitud);
  } catch (error) {
    next(error);
  }
});

solicitudesRouter.put('/:id', async (req, res, next) => {
  try {
    const solicitud = await actualizarSolicitud(req.user, Number(req.params.id), req.body);
    res.json(solicitud);
  } catch (error) {
    next(error);
  }
});

solicitudesRouter.post('/:id/estado', async (req, res, next) => {
  try {
    const solicitud = await cambiarEstado(req.user, Number(req.params.id), req.body.a, req.body.nota || '');
    res.json(solicitud);
  } catch (error) {
    next(error);
  }
});
