import { getDb } from '../../core/db.js';

export async function listOrigenes() {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM origenes ORDER BY nombre');
  return rows.map(normalizeRow);
}

export async function listMotivos() {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM motivos ORDER BY nombre');
  return rows.map(normalizeRow);
}

function normalizeRow(row) {
  return {
    ...row,
    activo: row.activo === 1
  };
}

export async function findOrigenById(id) {
  const db = await getDb();
  const row = await db.get('SELECT * FROM origenes WHERE id = ?', id);
  return row ? normalizeRow(row) : null;
}

export async function findMotivoById(id) {
  const db = await getDb();
  const row = await db.get('SELECT * FROM motivos WHERE id = ?', id);
  return row ? normalizeRow(row) : null;
}

export async function findOrigenByName(name) {
  const db = await getDb();
  return db.get('SELECT * FROM origenes WHERE nombre_normalizado = ?', name.toLowerCase());
}

export async function findMotivoByName(name) {
  const db = await getDb();
  return db.get('SELECT * FROM motivos WHERE nombre_normalizado = ?', name.toLowerCase());
}

export async function createOrigen({ nombre, descripcion, activo, ahora }) {
  const db = await getDb();
  const result = await db.run(
    'INSERT INTO origenes(nombre, nombre_normalizado, descripcion, activo, contador_uso, creado_en, actualizado_en) VALUES(?,?,?,?,0,?,?)',
    nombre,
    nombre.toLowerCase(),
    descripcion,
    activo ? 1 : 0,
    ahora,
    ahora
  );
  return { id: result.lastID };
}

export async function createMotivo({ nombre, descripcion, activo, ahora }) {
  const db = await getDb();
  const result = await db.run(
    'INSERT INTO motivos(nombre, nombre_normalizado, descripcion, activo, contador_uso, creado_en, actualizado_en) VALUES(?,?,?,?,0,?,?)',
    nombre,
    nombre.toLowerCase(),
    descripcion,
    activo ? 1 : 0,
    ahora,
    ahora
  );
  return { id: result.lastID };
}

export async function updateOrigen(id, { nombre, descripcion, activo, ahora }) {
  const db = await getDb();
  await db.run(
    'UPDATE origenes SET nombre = ?, nombre_normalizado = ?, descripcion = ?, activo = ?, actualizado_en = ? WHERE id = ?',
    nombre,
    nombre.toLowerCase(),
    descripcion,
    activo ? 1 : 0,
    ahora,
    id
  );
}

export async function updateMotivo(id, { nombre, descripcion, activo, ahora }) {
  const db = await getDb();
  await db.run(
    'UPDATE motivos SET nombre = ?, nombre_normalizado = ?, descripcion = ?, activo = ?, actualizado_en = ? WHERE id = ?',
    nombre,
    nombre.toLowerCase(),
    descripcion,
    activo ? 1 : 0,
    ahora,
    id
  );
}

export async function deleteOrigen(id) {
  const db = await getDb();
  await db.run('DELETE FROM origenes WHERE id = ?', id);
}

export async function deleteMotivo(id) {
  const db = await getDb();
  await db.run('DELETE FROM motivos WHERE id = ?', id);
}

export async function updateOrigenUsage(id, delta) {
  const db = await getDb();
  await db.run('UPDATE origenes SET contador_uso = contador_uso + ?, actualizado_en = ? WHERE id = ?', delta, new Date().toISOString(), id);
}

export async function updateMotivoUsage(id, delta) {
  const db = await getDb();
  await db.run('UPDATE motivos SET contador_uso = contador_uso + ?, actualizado_en = ? WHERE id = ?', delta, new Date().toISOString(), id);
}

export async function countSolicitudesPorCatalogo(tipo, id) {
  const db = await getDb();
  const col = tipo === 'origen' ? 'origen_id' : 'motivo_id';
  const row = await db.get(`SELECT COUNT(1) as total FROM solicitudes WHERE ${col} = ?`, id);
  return row.total;
}
