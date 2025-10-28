import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { SECURITY_CONFIG, APP_CONFIG } from '../../core/config.js';
import { nowUtc, addMinutes, isExpired } from '../../core/utils/date.js';
import { ValidationError, ensureLength, ensurePattern, ensureEnum } from '../../core/utils/validation.js';
import { conflict, forbidden, unauthorized } from '../../core/utils/errors.js';
import {
  findUserByEmail,
  findUserById,
  listUsers,
  createUser,
  updateUser,
  updatePassword,
  updateLastAccess,
  createSession,
  findSession,
  deleteSession,
  deleteSessionsByUser,
  purgeExpiredSessions
} from './repository.js';
import { registerAudit } from '../auditoria/service.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function authenticate(email, credencial, userAgent) {
  if (!email || !credencial) {
    throw unauthorized();
  }
  const user = await findUserByEmail(email);
  if (!user || !user.activo) {
    throw unauthorized();
  }
  const match = await bcrypt.compare(credencial, user.hash_credencial);
  if (!match) {
    throw unauthorized();
  }
  const token = crypto.randomBytes(SECURITY_CONFIG.tokenLength).toString('hex');
  const now = nowUtc();
  const expiracion = addMinutes(now, APP_CONFIG.sessionExpiryMinutes);
  await purgeExpiredSessions(now);
  await createSession({ usuario_id: user.id, token, expiracion, creado_en: now });
  await updateLastAccess(user.id, now);
  await registerAudit({
    usuarioId: user.id,
    accion: 'login',
    entidad: 'usuario',
    entidadId: user.id,
    detalle: { userAgent }
  });
  return { token, rol: user.rol, nombre: user.nombre, expiracion, id: user.id };
}

export async function closeSession(token, usuarioId) {
  if (token) {
    await deleteSession(token);
  }
  if (usuarioId) {
    await registerAudit({
      usuarioId,
      accion: 'logout',
      entidad: 'usuario',
      entidadId: usuarioId,
      detalle: {}
    });
  }
}

export async function resolveSession(token) {
  if (!token) {
    return null;
  }
  const session = await findSession(token);
  if (!session) {
    return null;
  }
  if (isExpired(session.expiracion) || !session.activo) {
    await deleteSession(token);
    return null;
  }
  return {
    id: session.usuario_id,
    nombre: session.nombre,
    email: session.email,
    rol: session.rol,
    token: session.token,
    expiracion: session.expiracion
  };
}

export async function ensureAdmin(user) {
  if (!user || user.rol !== 'admin') {
    throw forbidden('admin_only');
  }
}

export async function listAllUsers(requester) {
  await ensureAdmin(requester);
  return listUsers();
}

export async function createNewUser(requester, payload) {
  await ensureAdmin(requester);
  const { nombre, email, rol, area, activo = true, credencial } = payload;
  ensureLength(nombre, 'nombre', { min: 2, max: 80 });
  ensurePattern(email, 'email', emailPattern, 'Formato de correo inválido.');
  ensureEnum(rol, 'rol', ['admin', 'usuario']);
  ensureLength(credencial, 'credencial', { min: SECURITY_CONFIG.passwordMinLength, max: 128 });
  const existing = await findUserByEmail(email);
  if (existing) {
    throw conflict('email_duplicado');
  }
  const hash = await bcrypt.hash(credencial, SECURITY_CONFIG.saltRounds);
  const { id } = await createUser({ nombre, email, hash, rol, area, activo });
  await registerAudit({
    usuarioId: requester.id,
    accion: 'crear',
    entidad: 'usuario',
    entidadId: id,
    detalle: { nombre, email, rol }
  });
  return { id };
}

export async function updateExistingUser(requester, id, payload) {
  await ensureAdmin(requester);
  const user = await findUserById(id);
  if (!user) {
    throw conflict('usuario_inexistente');
  }
  const { nombre, email, rol, area, activo } = payload;
  ensureLength(nombre, 'nombre', { min: 2, max: 80 });
  ensurePattern(email, 'email', emailPattern, 'Formato de correo inválido.');
  ensureEnum(rol, 'rol', ['admin', 'usuario']);
  const existing = await findUserByEmail(email);
  if (existing && existing.id !== user.id) {
    throw conflict('email_duplicado');
  }
  await updateUser(id, { nombre, email, rol, area, activo });
  if (!activo) {
    await deleteSessionsByUser(id);
  }
  await registerAudit({
    usuarioId: requester.id,
    accion: 'editar',
    entidad: 'usuario',
    entidadId: id,
    detalle: { nombre, email, rol, activo }
  });
}

export async function updateUserPassword(requester, id, credencial) {
  const target = await findUserById(id);
  if (!target) {
    throw conflict('usuario_inexistente');
  }
  if (requester.id !== id && requester.rol !== 'admin') {
    throw forbidden('password_update');
  }
  ensureLength(credencial, 'credencial', { min: SECURITY_CONFIG.passwordMinLength, max: 128 });
  const hash = await bcrypt.hash(credencial, SECURITY_CONFIG.saltRounds);
  await updatePassword(id, hash);
  await deleteSessionsByUser(id);
  await registerAudit({
    usuarioId: requester.id,
    accion: 'editar',
    entidad: 'usuario',
    entidadId: id,
    detalle: { passwordReset: requester.id !== id }
  });
}

export async function toggleUserActive(requester, id, activo) {
  await ensureAdmin(requester);
  const user = await findUserById(id);
  if (!user) {
    throw conflict('usuario_inexistente');
  }
  await updateUser(id, {
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    area: user.area,
    activo
  });
  if (!activo) {
    await deleteSessionsByUser(id);
  }
  await registerAudit({
    usuarioId: requester.id,
    accion: activo ? 'editar' : 'editar',
    entidad: 'usuario',
    entidadId: id,
    detalle: { activo }
  });
}
