import express from 'express';
import cookieParser from 'cookie-parser';
import { requireAuth } from '../../core/middleware/session.js';
import {
  authenticate,
  closeSession,
  listAllUsers,
  createNewUser,
  updateExistingUser,
  updateUserPassword,
  toggleUserActive
} from './service.js';

export const authRouter = express.Router();
authRouter.use(cookieParser());

authRouter.post('/auth/login', async (req, res, next) => {
  try {
    const { email, credencial } = req.body;
    const auth = await authenticate(email, credencial, req.headers['user-agent']);
    res.cookie('session_token', auth.token, { httpOnly: true });
    res.json(auth);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/auth/logout', requireAuth(), async (req, res, next) => {
  try {
    await closeSession(req.token, req.user?.id);
    res.clearCookie('session_token');
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

authRouter.get('/auth/me', requireAuth(), async (req, res) => {
  res.json({ id: req.user.id, nombre: req.user.nombre, email: req.user.email, rol: req.user.rol });
});

authRouter.get('/usuarios', requireAuth(), async (req, res, next) => {
  try {
    const usuarios = await listAllUsers(req.user);
    res.json(usuarios);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/usuarios', requireAuth(), async (req, res, next) => {
  try {
    const usuario = await createNewUser(req.user, req.body);
    res.status(201).json(usuario);
  } catch (error) {
    next(error);
  }
});

authRouter.put('/usuarios/:id', requireAuth(), async (req, res, next) => {
  try {
    await updateExistingUser(req.user, Number(req.params.id), req.body);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

authRouter.patch('/usuarios/:id/credencial', requireAuth(), async (req, res, next) => {
  try {
    await updateUserPassword(req.user, Number(req.params.id), req.body.credencial);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

authRouter.patch('/usuarios/:id/activo', requireAuth(), async (req, res, next) => {
  try {
    await toggleUserActive(req.user, Number(req.params.id), !!req.body.activo);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
