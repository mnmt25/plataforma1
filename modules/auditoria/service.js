import { nowUtc } from '../../core/utils/date.js';
import { ensureAdmin } from '../usuarios/service.js';
import { insertAudit, listAudit } from './repository.js';

export async function registerAudit({ usuarioId, accion, entidad, entidadId, detalle }) {
  const fecha = nowUtc();
  await insertAudit({ usuarioId, fecha, accion, entidad, entidadId, detalle });
}

export async function queryAudit(requester, filtros) {
  await ensureAdmin(requester);
  return listAudit(filtros);
}
