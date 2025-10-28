import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { once } from 'events';
import { startServer } from '../core/server.js';
import { initDatabase } from '../scripts/init-db.js';
import { APP_CONFIG } from '../core/config.js';
import { closeDb } from '../core/db.js';

let server;

async function setup() {
  if (fs.existsSync(APP_CONFIG.dbFile)) {
    fs.rmSync(APP_CONFIG.dbFile);
  }
  if (fs.existsSync(APP_CONFIG.seedFlagFile)) {
    fs.rmSync(APP_CONFIG.seedFlagFile);
  }
  await initDatabase();
  server = startServer();
  await once(server, 'listening');
}

async function teardown() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeDb();
  if (fs.existsSync(APP_CONFIG.dbFile)) {
    fs.rmSync(APP_CONFIG.dbFile);
  }
  if (fs.existsSync(APP_CONFIG.seedFlagFile)) {
    fs.rmSync(APP_CONFIG.seedFlagFile);
  }
}

async function login(email, credencial) {
  const res = await fetch(`http://localhost:${APP_CONFIG.port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, credencial })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  return data;
}

test('API flujo principal', async (t) => {
  await setup();
  t.after(async () => {
    await teardown();
  });

  const adminAuth = await login('admin@lab.local', 'AdminSeguro1!');
  assert.ok(adminAuth.token);
  const solicitudesRes = await fetch(`http://localhost:${APP_CONFIG.port}/api/solicitudes?page=1&size=20`, {
    headers: { Authorization: `Bearer ${adminAuth.token}` }
  });
  assert.equal(solicitudesRes.status, 200);
  const listado = await solicitudesRes.json();
  assert.equal(listado.items.length > 0, true);
  assert.equal(listado.total >= listado.items.length, true);

  const userAuth = await login('carlos@lab.local', 'UsuarioSeguro1!');
  const crearRes = await fetch(`http://localhost:${APP_CONFIG.port}/api/solicitudes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userAuth.token}`
    },
    body: JSON.stringify({
      job: 'JOB999',
      origen_id: 1,
      motivo_id: 1,
      analito: 'Prueba',
      observaciones: 'Solicitud de prueba'
    })
  });
  assert.equal(crearRes.status, 201);
  const creada = await crearRes.json();
  assert.equal(creada.estado, 'borrador');

  const transRes = await fetch(`http://localhost:${APP_CONFIG.port}/api/solicitudes/${creada.id}/estado`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userAuth.token}`
    },
    body: JSON.stringify({ a: 'en_revision' })
  });
  assert.equal(transRes.status, 200);
  const actualizada = await transRes.json();
  assert.equal(actualizada.estado, 'en_revision');

  const exportRes = await fetch(`http://localhost:${APP_CONFIG.port}/api/export/solicitudes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAuth.token}`
    },
    body: JSON.stringify({})
  });
  assert.equal(exportRes.status, 200);
  const exportData = await exportRes.json();
  assert.ok(exportData.contenido);
});
