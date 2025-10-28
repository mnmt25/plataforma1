import { getDb } from '../../core/db.js';

export async function findUserByEmail(email) {
  const db = await getDb();
  return db.get('SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?)', email);
}

export async function findUserById(id) {
  const db = await getDb();
  return db.get('SELECT * FROM usuarios WHERE id = ?', id);
}

export async function listUsers() {
  const db = await getDb();
  const rows = await db.all('SELECT id, nombre, email, rol, area, activo, ultimo_acceso FROM usuarios');
  return rows;
}

export async function createUser({ nombre, email, hash, rol, area, activo }) {
  const db = await getDb();
  const result = await db.run(
    'INSERT INTO usuarios(nombre, email, hash_credencial, rol, area, activo) VALUES(?,?,?,?,?,?)',
    nombre,
    email,
    hash,
    rol,
    area,
    activo ? 1 : 0
  );
  return { id: result.lastID };
}

export async function updateUser(id, { nombre, email, rol, area, activo }) {
  const db = await getDb();
  await db.run(
    'UPDATE usuarios SET nombre = ?, email = ?, rol = ?, area = ?, activo = ? WHERE id = ?',
    nombre,
    email,
    rol,
    area,
    activo ? 1 : 0,
    id
  );
}

export async function updatePassword(id, hash) {
  const db = await getDb();
  await db.run('UPDATE usuarios SET hash_credencial = ? WHERE id = ?', hash, id);
}

export async function updateLastAccess(id, date) {
  const db = await getDb();
  await db.run('UPDATE usuarios SET ultimo_acceso = ? WHERE id = ?', date, id);
}

export async function createSession({ usuario_id, token, expiracion, creado_en }) {
  const db = await getDb();
  await db.run(
    'INSERT INTO sesiones(usuario_id, token, expiracion, creado_en) VALUES(?,?,?,?)',
    usuario_id,
    token,
    expiracion,
    creado_en
  );
}

export async function findSession(token) {
  const db = await getDb();
  return db.get('SELECT s.*, u.nombre, u.email, u.rol, u.activo FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ?', token);
}

export async function deleteSession(token) {
  const db = await getDb();
  await db.run('DELETE FROM sesiones WHERE token = ?', token);
}

export async function deleteSessionsByUser(usuarioId) {
  const db = await getDb();
  await db.run('DELETE FROM sesiones WHERE usuario_id = ?', usuarioId);
}

export async function purgeExpiredSessions(now) {
  const db = await getDb();
  await db.run('DELETE FROM sesiones WHERE expiracion <= ?', now);
}
