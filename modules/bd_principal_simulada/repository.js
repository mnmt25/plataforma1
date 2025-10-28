import { getDb } from '../../core/db.js';

export async function searchBDP({ job, id_muestra, analito }) {
  const db = await getDb();
  const conditions = [];
  const params = [];
  if (job) {
    conditions.push('LOWER(job) = LOWER(?)');
    params.push(job);
  }
  if (id_muestra) {
    conditions.push('LOWER(id_muestra) = LOWER(?)');
    params.push(id_muestra);
  }
  if (analito) {
    conditions.push('LOWER(analito) = LOWER(?)');
    params.push(analito);
  }
  if (conditions.length === 0) {
    return [];
  }
  const where = conditions.join(' OR ');
  const rows = await db.all(`SELECT * FROM bd_principal_simulada WHERE ${where}`, params);
  return rows.map((row) => ({
    ...row,
    datos_extra: row.datos_extra ? JSON.parse(row.datos_extra) : {}
  }));
}
