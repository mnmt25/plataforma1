import { requireOneOf, ensureLength, ensurePattern } from '../../core/utils/validation.js';
import { nowUtc } from '../../core/utils/date.js';
import { conflict, forbidden, limitExceeded, notFound } from '../../core/utils/errors.js';
import { APP_CONFIG } from '../../core/config.js';
import {
  listSolicitudes,
  countSolicitudes,
  findSolicitudById,
  insertSolicitud,
  updateSolicitud,
  updateSolicitudEstado,
  computeDashboardStats
} from './repository.js';
import {
  findOrigenById,
  findMotivoById,
  updateOrigenUsage,
  updateMotivoUsage
} from '../catalogos/repository.js';
import { searchBDP } from '../bd_principal_simulada/repository.js';
import { registerAudit } from '../auditoria/service.js';
import xlsx from 'xlsx';

const estadosOrden = ['borrador', 'en_revision', 'en_analisis', 'cerrado'];
const jobPattern = /^[A-Za-z0-9]{3,20}$/;
const idMuestraPattern = /^[A-Za-z0-9]{3,32}$/;
const analitoPattern = /^.{2,80}$/;

function ensurePageSize(size) {
  if (!size || Number.isNaN(size)) return 20;
  return Math.max(1, Math.min(200, size));
}

export async function listarSolicitudes(requester, filtros) {
  const page = filtros.page ? Number(filtros.page) : 1;
  const size = ensurePageSize(filtros.size ? Number(filtros.size) : 20);
  const payload = {
    query: filtros.query ? filtros.query.toLowerCase() : null,
    estados: filtros.estado ? [].concat(filtros.estado) : [],
    origenes: filtros.origen ? [].concat(filtros.origen).map(Number) : [],
    motivos: filtros.motivo ? [].concat(filtros.motivo).map(Number) : [],
    creador: filtros.creador ? Number(filtros.creador) : null,
    desde: filtros.desde || null,
    hasta: filtros.hasta || null,
    page,
    size,
    sort: filtros.sort
  };
  const items = await listSolicitudes(payload);
  const total = await countSolicitudes(payload);
  return { items, total, page, size };
}

export async function obtenerSolicitudDetalle(requester, id) {
  const solicitud = await findSolicitudById(id);
  if (!solicitud) {
    throw notFound('solicitud', id);
  }
  if (requester.rol !== 'admin' && solicitud.creador_id !== requester.id) {
    throw forbidden('ver_solicitud');
  }
  return solicitud;
}

async function validarCatalogos(origenId, motivoId) {
  const origen = await findOrigenById(origenId);
  if (!origen || !origen.activo) {
    throw conflict('origen_inactivo');
  }
  const motivo = await findMotivoById(motivoId);
  if (!motivo || !motivo.activo) {
    throw conflict('motivo_inactivo');
  }
  return { origen, motivo };
}

function validarCamposSolicitud(payload) {
  requireOneOf(payload, ['job', 'id_muestra', 'analito']);
  if (payload.job) {
    ensurePattern(payload.job, 'job', jobPattern, 'Formato inválido (3-20 alfanumérico).');
  }
  if (payload.id_muestra) {
    ensurePattern(payload.id_muestra, 'id_muestra', idMuestraPattern, 'Formato inválido (3-32 alfanumérico).');
  }
  if (payload.analito) {
    ensurePattern(payload.analito, 'analito', analitoPattern, 'Longitud permitida 2-80.');
  }
  if (payload.observaciones) {
    ensureLength(payload.observaciones, 'observaciones', { min: 0, max: 2000 });
  }
}

export async function crearSolicitud(requester, payload) {
  validarCamposSolicitud(payload);
  const { origen, motivo } = await validarCatalogos(payload.origen_id, payload.motivo_id);
  const ahora = nowUtc();
  const matches = await searchBDP({ job: payload.job, id_muestra: payload.id_muestra, analito: payload.analito });
  const snapshot = matches.length ? matches[0] : {};
  const historial = [{ de: null, a: 'borrador', fecha: ahora, usuario_id: requester.id, nota: 'creacion' }];
  const data = {
    fecha_creacion: ahora,
    fecha_actualizacion: ahora,
    creador_id: requester.id,
    estado: 'borrador',
    job: payload.job || null,
    id_muestra: payload.id_muestra || null,
    analito: payload.analito || null,
    origen_id: payload.origen_id,
    motivo_id: payload.motivo_id,
    observaciones: payload.observaciones || null,
    snapshot_datos: snapshot,
    historial_cambios: historial
  };
  const { id } = await insertSolicitud(data);
  await updateOrigenUsage(origen.id, 1);
  await updateMotivoUsage(motivo.id, 1);
  await registerAudit({ usuarioId: requester.id, accion: 'crear', entidad: 'solicitud', entidadId: id, detalle: { estado: 'borrador' } });
  return await findSolicitudById(id);
}

export async function actualizarSolicitud(requester, id, payload) {
  const solicitud = await findSolicitudById(id);
  if (!solicitud) {
    throw notFound('solicitud', id);
  }
  if (requester.rol !== 'admin' && solicitud.creador_id !== requester.id) {
    throw forbidden('editar_solicitud');
  }
  if (solicitud.estado !== 'borrador' && requester.rol !== 'admin') {
    throw conflict('solo_borrador_editable');
  }
  validarCamposSolicitud({ ...solicitud, ...payload });
  const { origen, motivo } = await validarCatalogos(payload.origen_id ?? solicitud.origen_id, payload.motivo_id ?? solicitud.motivo_id);
  const ahora = nowUtc();
  const historial = solicitud.historial_cambios || [];
  const updated = {
    fecha_actualizacion: ahora,
    origen_id: payload.origen_id ?? solicitud.origen_id,
    motivo_id: payload.motivo_id ?? solicitud.motivo_id,
    observaciones: payload.observaciones ?? solicitud.observaciones,
    historial_cambios: historial
  };
  if (solicitud.origen_id !== updated.origen_id) {
    await updateOrigenUsage(solicitud.origen_id, -1);
    await updateOrigenUsage(updated.origen_id, 1);
  }
  if (solicitud.motivo_id !== updated.motivo_id) {
    await updateMotivoUsage(solicitud.motivo_id, -1);
    await updateMotivoUsage(updated.motivo_id, 1);
  }
  await updateSolicitud(id, updated);
  await registerAudit({ usuarioId: requester.id, accion: 'editar', entidad: 'solicitud', entidadId: id, detalle: { campos: Object.keys(payload) } });
  return await findSolicitudById(id);
}

function validarTransicion(actual, destino, rol) {
  if (actual === destino) {
    throw conflict('estado_igual');
  }
  const indexActual = estadosOrden.indexOf(actual);
  const indexDestino = estadosOrden.indexOf(destino);
  if (indexDestino === -1) {
    throw conflict('estado_invalido');
  }
  if (rol === 'admin') {
    if (actual === 'cerrado' && destino === 'en_analisis') {
      return true;
    }
  }
  if (indexDestino === indexActual + 1) {
    if (rol === 'usuario' && destino === 'cerrado') {
      throw forbidden('transicion_no_autorizada');
    }
    if (rol === 'usuario' && actual === 'en_revision' && destino === 'en_analisis') {
      return true;
    }
    if (rol === 'usuario' && actual === 'borrador' && destino === 'en_revision') {
      return true;
    }
    if (rol === 'admin') {
      return true;
    }
  }
  if (rol === 'admin' && actual === 'en_analisis' && destino === 'cerrado') {
    return true;
  }
  throw forbidden('transicion_no_valida');
}

export async function cambiarEstado(requester, id, destino, nota = '') {
  const solicitud = await findSolicitudById(id);
  if (!solicitud) {
    throw notFound('solicitud', id);
  }
  validarTransicion(solicitud.estado, destino, requester.rol);
  if (requester.rol !== 'admin' && solicitud.creador_id !== requester.id) {
    throw forbidden('transicion_solicitud');
  }
  const ahora = nowUtc();
  const historial = solicitud.historial_cambios || [];
  historial.push({ de: solicitud.estado, a: destino, fecha: ahora, usuario_id: requester.id, nota });
  await updateSolicitudEstado(id, { fecha_actualizacion: ahora, estado: destino, historial_cambios: historial });
  await registerAudit({ usuarioId: requester.id, accion: 'transicion_estado', entidad: 'solicitud', entidadId: id, detalle: { de: solicitud.estado, a: destino } });
  return await findSolicitudById(id);
}

export async function dashboardData(requester, filtros) {
  if (!requester) {
    throw forbidden('dashboard');
  }
  const stats = await computeDashboardStats(filtros);
  const totalSolicitudes = stats.totalRow.total;
  const estados = estadosOrden.map((estado) => ({ estado, total: stats.estados.find((e) => e.estado === estado)?.total || 0 }));
  const promedio = stats.tiempos.length
    ? Math.round(
        stats.tiempos
          .map((t) => new Date(t.fecha_actualizacion).getTime() - new Date(t.fecha_creacion).getTime())
          .reduce((acc, cur) => acc + cur, 0) /
          stats.tiempos.length /
          (1000 * 60 * 60)
      )
    : 0;
  return {
    total: totalSolicitudes,
    estados,
    origenTop: stats.origenTop,
    motivoTop: stats.motivoTop,
    promedioHorasResolucion: promedio,
    recientes: stats.recientes
  };
}

export async function exportarSolicitudes(requester, filtros) {
  const resultado = await listarSolicitudes(requester, { ...filtros, page: 1, size: APP_CONFIG.exportRowLimit });
  if (resultado.total > APP_CONFIG.exportRowLimit) {
    throw limitExceeded(APP_CONFIG.exportRowLimit, 'Refine los filtros para exportar menos registros.');
  }
  const rows = resultado.items.map((item) => ({
    ID: item.id,
    FechaCreacion: item.fecha_creacion,
    Estado: item.estado,
    Job: item.job,
    Muestra: item.id_muestra,
    Analito: item.analito,
    Origen: item.origen_nombre,
    Motivo: item.motivo_nombre,
    Creador: item.creador_nombre,
    UltimaActualizacion: item.fecha_actualizacion
  }));
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(rows);
  xlsx.utils.book_append_sheet(wb, ws, 'Solicitudes');
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const base64 = buffer.toString('base64');
  const filename = `solicitudes_${Date.now()}.xlsx`;
  await registerAudit({
    usuarioId: requester.id,
    accion: 'exportar',
    entidad: 'solicitud',
    entidadId: null,
    detalle: { filtros, archivo: filename }
  });
  return { archivo: filename, contenido: base64 };
}
