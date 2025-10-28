import { nowUtc } from '../../core/utils/date.js';
import { ensureLength } from '../../core/utils/validation.js';
import { conflict, forbidden } from '../../core/utils/errors.js';
import {
  listOrigenes,
  listMotivos,
  findOrigenById,
  findMotivoById,
  findOrigenByName,
  findMotivoByName,
  createOrigen,
  createMotivo,
  updateOrigen,
  updateMotivo,
  deleteOrigen,
  deleteMotivo,
  countSolicitudesPorCatalogo
} from './repository.js';
import { ensureAdmin } from '../usuarios/service.js';
import { registerAudit } from '../auditoria/service.js';

export async function obtenerOrigenes() {
  return listOrigenes();
}

export async function obtenerMotivos() {
  return listMotivos();
}

function validarCatalogo({ nombre, descripcion }) {
  ensureLength(nombre, 'nombre', { min: 2, max: 80 });
  if (descripcion) {
    ensureLength(descripcion, 'descripcion', { min: 0, max: 240 });
  }
}

export async function crearOrigen(requester, payload) {
  await ensureAdmin(requester);
  validarCatalogo(payload);
  const existing = await findOrigenByName(payload.nombre);
  if (existing) {
    throw conflict('origen_duplicado');
  }
  const ahora = nowUtc();
  const { id } = await createOrigen({ ...payload, ahora, activo: payload.activo !== false });
  await registerAudit({ usuarioId: requester.id, accion: 'crear', entidad: 'origen', entidadId: id, detalle: payload });
  return { id };
}

export async function crearMotivo(requester, payload) {
  await ensureAdmin(requester);
  validarCatalogo(payload);
  const existing = await findMotivoByName(payload.nombre);
  if (existing) {
    throw conflict('motivo_duplicado');
  }
  const ahora = nowUtc();
  const { id } = await createMotivo({ ...payload, ahora, activo: payload.activo !== false });
  await registerAudit({ usuarioId: requester.id, accion: 'crear', entidad: 'motivo', entidadId: id, detalle: payload });
  return { id };
}

export async function actualizarOrigen(requester, id, payload) {
  await ensureAdmin(requester);
  const origen = await findOrigenById(id);
  if (!origen) {
    throw conflict('origen_inexistente');
  }
  validarCatalogo(payload);
  const existing = await findOrigenByName(payload.nombre);
  if (existing && existing.id !== origen.id) {
    throw conflict('origen_duplicado');
  }
  await updateOrigen(id, { ...payload, ahora: nowUtc(), activo: payload.activo !== false });
  await registerAudit({ usuarioId: requester.id, accion: 'editar', entidad: 'origen', entidadId: id, detalle: payload });
}

export async function actualizarMotivo(requester, id, payload) {
  await ensureAdmin(requester);
  const motivo = await findMotivoById(id);
  if (!motivo) {
    throw conflict('motivo_inexistente');
  }
  validarCatalogo(payload);
  const existing = await findMotivoByName(payload.nombre);
  if (existing && existing.id !== motivo.id) {
    throw conflict('motivo_duplicado');
  }
  await updateMotivo(id, { ...payload, ahora: nowUtc(), activo: payload.activo !== false });
  await registerAudit({ usuarioId: requester.id, accion: 'editar', entidad: 'motivo', entidadId: id, detalle: payload });
}

export async function eliminarOrigen(requester, id) {
  await ensureAdmin(requester);
  const origen = await findOrigenById(id);
  if (!origen) {
    throw conflict('origen_inexistente');
  }
  const count = await countSolicitudesPorCatalogo('origen', id);
  if (count > 0) {
    throw conflict('origen_en_uso');
  }
  await deleteOrigen(id);
  await registerAudit({ usuarioId: requester.id, accion: 'eliminar', entidad: 'origen', entidadId: id, detalle: {} });
}

export async function eliminarMotivo(requester, id) {
  await ensureAdmin(requester);
  const motivo = await findMotivoById(id);
  if (!motivo) {
    throw conflict('motivo_inexistente');
  }
  const count = await countSolicitudesPorCatalogo('motivo', id);
  if (count > 0) {
    throw conflict('motivo_en_uso');
  }
  await deleteMotivo(id);
  await registerAudit({ usuarioId: requester.id, accion: 'eliminar', entidad: 'motivo', entidadId: id, detalle: {} });
}
