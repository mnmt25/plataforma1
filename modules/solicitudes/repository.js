import { getDb } from '../../core/db.js';

function mapRow(row) {
  return {
    ...row,
    snapshot_datos: row.snapshot_datos ? JSON.parse(row.snapshot_datos) : {},
    historial_cambios: row.historial_cambios ? JSON.parse(row.historial_cambios) : []
  };
}

export async function listSolicitudes(filters) {
  const db = await getDb();
  const { conditions, params } = buildFilters(filters);
  const sortClause = buildSort(filters.sort);
  const limit = filters.size;
  const offset = (filters.page - 1) * filters.size;
  const rows = await db.all(
    `SELECT s.*, o.nombre AS origen_nombre, m.nombre AS motivo_nombre, u.nombre AS creador_nombre
     FROM solicitudes s
     JOIN origenes o ON o.id = s.origen_id
     JOIN motivos m ON m.id = s.motivo_id
     JOIN usuarios u ON u.id = s.creador_id
     ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
     ${sortClause}
     LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  return rows.map(mapRow);
}

export async function countSolicitudes(filters) {
  const db = await getDb();
  const { conditions, params } = buildFilters(filters);
  const row = await db.get(
    `SELECT COUNT(1) as total FROM solicitudes s
     ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}`,
    ...params
  );
  return row.total;
}

function buildFilters({ query, estados = [], origenes = [], motivos = [], creador, desde, hasta }) {
  const conditions = [];
  const params = [];
  if (query) {
    conditions.push('(LOWER(s.job) LIKE ? OR LOWER(s.id_muestra) LIKE ? OR LOWER(s.analito) LIKE ? OR CAST(s.id AS TEXT) LIKE ?)');
    const q = `%${query.toLowerCase()}%`;
    params.push(q, q, q, q);
  }
  if (estados.length) {
    conditions.push(`s.estado IN (${estados.map(() => '?').join(',')})`);
    params.push(...estados);
  }
  if (origenes.length) {
    conditions.push(`s.origen_id IN (${origenes.map(() => '?').join(',')})`);
    params.push(...origenes);
  }
  if (motivos.length) {
    conditions.push(`s.motivo_id IN (${motivos.map(() => '?').join(',')})`);
    params.push(...motivos);
  }
  if (creador) {
    conditions.push('s.creador_id = ?');
    params.push(creador);
  }
  if (desde) {
    conditions.push('s.fecha_creacion >= ?');
    params.push(desde);
  }
  if (hasta) {
    conditions.push('s.fecha_creacion <= ?');
    params.push(hasta);
  }
  return { conditions, params };
}

function buildSort(sort) {
  if (!sort) {
    return 'ORDER BY s.fecha_creacion DESC';
  }
  const [field, direction] = sort.split(',');
  const allowed = {
    id: 's.id',
    fecha_creacion: 's.fecha_creacion',
    estado: 's.estado',
    job: 's.job',
    id_muestra: 's.id_muestra',
    analito: 's.analito',
    origen: 'o.nombre',
    motivo: 'm.nombre',
    creador: 'u.nombre',
    ultima_actualizacion: 's.fecha_actualizacion'
  };
  const column = allowed[field];
  if (!column) {
    return 'ORDER BY s.fecha_creacion DESC';
  }
  const dir = direction && direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return `ORDER BY ${column} ${dir}`;
}

export async function findSolicitudById(id) {
  const db = await getDb();
  const row = await db.get(
    `SELECT s.*, o.nombre AS origen_nombre, m.nombre AS motivo_nombre, u.nombre AS creador_nombre
     FROM solicitudes s
     JOIN origenes o ON o.id = s.origen_id
     JOIN motivos m ON m.id = s.motivo_id
     JOIN usuarios u ON u.id = s.creador_id
     WHERE s.id = ?`,
    id
  );
  return row ? mapRow(row) : null;
}

export async function insertSolicitud(data) {
  const db = await getDb();
  const result = await db.run(
    `INSERT INTO solicitudes(
      fecha_creacion,
      fecha_actualizacion,
      creador_id,
      estado,
      job,
      id_muestra,
      analito,
      origen_id,
      motivo_id,
      observaciones,
      snapshot_datos,
      historial_cambios
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    data.fecha_creacion,
    data.fecha_actualizacion,
    data.creador_id,
    data.estado,
    data.job,
    data.id_muestra,
    data.analito,
    data.origen_id,
    data.motivo_id,
    data.observaciones,
    JSON.stringify(data.snapshot_datos || {}),
    JSON.stringify(data.historial_cambios || [])
  );
  return { id: result.lastID };
}

export async function updateSolicitud(id, updates) {
  const db = await getDb();
  await db.run(
    `UPDATE solicitudes SET
      fecha_actualizacion = ?,
      origen_id = ?,
      motivo_id = ?,
      observaciones = ?,
      historial_cambios = ?
    WHERE id = ?`,
    updates.fecha_actualizacion,
    updates.origen_id,
    updates.motivo_id,
    updates.observaciones,
    JSON.stringify(updates.historial_cambios || []),
    id
  );
}

export async function updateSolicitudEstado(id, updates) {
  const db = await getDb();
  await db.run(
    `UPDATE solicitudes SET
      fecha_actualizacion = ?,
      estado = ?,
      historial_cambios = ?
    WHERE id = ?`,
    updates.fecha_actualizacion,
    updates.estado,
    JSON.stringify(updates.historial_cambios || []),
    id
  );
}

export async function computeDashboardStats({ desde, hasta }) {
  const db = await getDb();
  const params = [];
  const clauses = [];
  if (desde) {
    clauses.push('fecha_creacion >= ?');
    params.push(desde);
  }
  if (hasta) {
    clauses.push('fecha_creacion <= ?');
    params.push(hasta);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const totalRow = await db.get(`SELECT COUNT(1) as total FROM solicitudes ${where}`, ...params);
  const estados = await db.all(`SELECT estado, COUNT(1) as total FROM solicitudes ${where} GROUP BY estado` , ...params);
  const origenTop = await db.all(`SELECT o.nombre as label, SUM(1) as total FROM solicitudes s JOIN origenes o ON o.id = s.origen_id ${where} GROUP BY o.nombre ORDER BY total DESC LIMIT 5`, ...params);
  const motivoTop = await db.all(`SELECT m.nombre as label, SUM(1) as total FROM solicitudes s JOIN motivos m ON m.id = s.motivo_id ${where} GROUP BY m.nombre ORDER BY total DESC LIMIT 5`, ...params);
  const tiempos = await db.all(`SELECT fecha_creacion, fecha_actualizacion FROM solicitudes WHERE estado = 'cerrado' ${where ? 'AND ' + where.replace('WHERE ', '') : ''}` , ...params);
  const recientes = await db.all(`SELECT s.id, s.fecha_creacion, s.estado, s.job, s.id_muestra, s.analito FROM solicitudes s ${where} ORDER BY s.fecha_creacion DESC LIMIT 10`, ...params);
  return { totalRow, estados, origenTop, motivoTop, tiempos, recientes };
}
