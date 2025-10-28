import { getDb } from '../../core/db.js';

export async function insertAudit({ usuarioId, fecha, accion, entidad, entidadId, detalle }) {
  const db = await getDb();
  await db.run(
    'INSERT INTO auditoria(usuario_id, fecha, accion, entidad, entidad_id, detalle) VALUES(?,?,?,?,?,?)',
    usuarioId,
    fecha,
    accion,
    entidad,
    entidadId,
    JSON.stringify(detalle || {})
  );
}

export async function listAudit({ desde, hasta, accion, usuarioId, limit = 200, offset = 0 }) {
  const db = await getDb();
  const clauses = [];
  const params = [];
  if (desde) {
    clauses.push('fecha >= ?');
    params.push(desde);
  }
  if (hasta) {
    clauses.push('fecha <= ?');
    params.push(hasta);
  }
  if (accion) {
    clauses.push('accion = ?');
    params.push(accion);
  }
  if (usuarioId) {
    clauses.push('usuario_id = ?');
    params.push(usuarioId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await db.all(
    `SELECT a.*, u.nombre AS usuario_nombre FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id ${where} ORDER BY fecha DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  return rows.map((row) => ({
    ...row,
    detalle: row.detalle ? JSON.parse(row.detalle) : {}
  }));
}
