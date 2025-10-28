import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { APP_CONFIG, SECURITY_CONFIG } from '../core/config.js';
import { getDb, closeDb } from '../core/db.js';
import { nowUtc } from '../core/utils/date.js';
import { bdpSeed } from '../modules/bd_principal_simulada/dataset.js';

export async function initDatabase() {
  const db = await getDb();
  try {
    const schemaPath = path.resolve('./db/scripts/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await db.exec(schema);

    await seedUsuarios(db);
    await seedCatalogos(db);
    await seedBDP(db);
    await seedSolicitudes(db);
    await recalcularContadores(db);

    fs.writeFileSync(APP_CONFIG.seedFlagFile, nowUtc());
  } finally {
    await closeDb();
  }
}

async function seedUsuarios(db) {
  const row = await db.get('SELECT COUNT(1) as total FROM usuarios');
  if (row.total > 0) {
    return;
  }
  const usuarios = [
    { nombre: 'Ana Admin', email: 'admin@lab.local', rol: 'admin', area: 'Calidad', activo: 1, password: 'AdminSeguro1!' },
    { nombre: 'Carlos Usuario', email: 'carlos@lab.local', rol: 'usuario', area: 'Operaciones', activo: 1, password: 'UsuarioSeguro1!' },
    { nombre: 'Lucia Usuario', email: 'lucia@lab.local', rol: 'usuario', area: 'Validaciones', activo: 1, password: 'UsuarioSeguro2!' }
  ];
  for (const usuario of usuarios) {
    const hash = await bcrypt.hash(usuario.password, SECURITY_CONFIG.saltRounds);
    await db.run(
      'INSERT INTO usuarios(nombre, email, hash_credencial, rol, area, activo, ultimo_acceso) VALUES(?,?,?,?,?,?,?)',
      usuario.nombre,
      usuario.email,
      hash,
      usuario.rol,
      usuario.area,
      usuario.activo,
      null
    );
  }
}

async function seedCatalogos(db) {
  const origenes = [
    { nombre: 'control_interno', descripcion: 'Solicitudes generadas por controles internos', activo: 1 },
    { nombre: 'reporte_cliente', descripcion: 'Revisión solicitada por el cliente', activo: 1 },
    { nombre: 'hallazgo_interno', descripcion: 'Hallazgos de auditorías internas', activo: 1 },
    { nombre: 'no_conformidad', descripcion: 'Derivada de no conformidades detectadas', activo: 1 },
    { nombre: 're_inspeccion', descripcion: 'Re-inspección programada', activo: 1 }
  ];
  const motivos = [
    { nombre: 'resultado_inconsistente', descripcion: 'Resultado fuera de tendencia', activo: 1 },
    { nombre: 'equipo_fuera_calibracion', descripcion: 'Equipamiento con calibración vencida', activo: 1 },
    { nombre: 'muestra_comprometida', descripcion: 'Posible contaminación o degradación', activo: 1 },
    { nombre: 'error_captura', descripcion: 'Error en la captura de datos', activo: 1 },
    { nombre: 'validacion_cruzada', descripcion: 'Validación cruzada requerida', activo: 1 },
    { nombre: 'limite_cuantificacion', descripcion: 'Resultados cercanos al límite de cuantificación', activo: 1 },
    { nombre: 'nuevo_metodo', descripcion: 'Aplicación de nuevo método analítico', activo: 1 },
    { nombre: 'auditoria_externa', descripcion: 'Requerimiento de auditoría externa', activo: 1 }
  ];
  const origenesRow = await db.get('SELECT COUNT(1) as total FROM origenes');
  if (origenesRow.total === 0) {
    for (const item of origenes) {
      const ahora = nowUtc();
      await db.run(
        'INSERT INTO origenes(nombre, nombre_normalizado, descripcion, activo, contador_uso, creado_en, actualizado_en) VALUES(?,?,?,?,0,?,?)',
        item.nombre,
        item.nombre.toLowerCase(),
        item.descripcion,
        item.activo,
        ahora,
        ahora
      );
    }
  }
  const motivosRow = await db.get('SELECT COUNT(1) as total FROM motivos');
  if (motivosRow.total === 0) {
    for (const item of motivos) {
      const ahora = nowUtc();
      await db.run(
        'INSERT INTO motivos(nombre, nombre_normalizado, descripcion, activo, contador_uso, creado_en, actualizado_en) VALUES(?,?,?,?,0,?,?)',
        item.nombre,
        item.nombre.toLowerCase(),
        item.descripcion,
        item.activo,
        ahora,
        ahora
      );
    }
  }
}

async function seedBDP(db) {
  const row = await db.get('SELECT COUNT(1) as total FROM bd_principal_simulada');
  if (row.total > 0) {
    return;
  }
  for (const item of bdpSeed) {
    await db.run(
      'INSERT INTO bd_principal_simulada(job, id_muestra, analito, cliente, proyecto, fecha_muestreo, responsable, datos_extra) VALUES(?,?,?,?,?,?,?,?)',
      item.job,
      item.id_muestra,
      item.analito,
      item.cliente,
      item.proyecto,
      item.fecha_muestreo,
      item.responsable,
      JSON.stringify(item.datos_extra)
    );
  }
}

async function seedSolicitudes(db) {
  const row = await db.get('SELECT COUNT(1) as total FROM solicitudes');
  if (row.total > 0) {
    return;
  }
  const usuarios = await db.all('SELECT * FROM usuarios ORDER BY id');
  const origenes = await db.all('SELECT * FROM origenes ORDER BY id');
  const motivos = await db.all('SELECT * FROM motivos ORDER BY id');
  const estados = ['borrador', 'en_revision', 'en_analisis', 'cerrado'];
  const solicitudes = [];
  for (let i = 0; i < 20; i++) {
    const estado = estados[i % estados.length];
    const usuario = usuarios[i % usuarios.length];
    const origen = origenes[i % origenes.length];
    const motivo = motivos[i % motivos.length];
    const base = bdpSeed[i % bdpSeed.length];
    const fechaCreacion = new Date(2024, 2, 1 + i, 8, 0, 0);
    const fechaActualizacion = new Date(fechaCreacion.getTime() + (i % 5) * 3600 * 1000);
    const historial = [{ de: null, a: 'borrador', fecha: fechaCreacion.toISOString(), usuario_id: usuario.id, nota: 'creada' }];
    if (estado !== 'borrador') {
      historial.push({ de: 'borrador', a: 'en_revision', fecha: new Date(fechaCreacion.getTime() + 3600 * 1000).toISOString(), usuario_id: usuario.id, nota: '' });
    }
    if (estado === 'en_analisis' || estado === 'cerrado') {
      historial.push({ de: 'en_revision', a: 'en_analisis', fecha: new Date(fechaCreacion.getTime() + 2 * 3600 * 1000).toISOString(), usuario_id: usuarios[(i + 1) % usuarios.length].id, nota: '' });
    }
    if (estado === 'cerrado') {
      const admin = usuarios.find((u) => u.rol === 'admin');
      historial.push({ de: 'en_analisis', a: 'cerrado', fecha: fechaActualizacion.toISOString(), usuario_id: admin.id, nota: 'cerrada por admin' });
    }
    solicitudes.push({ estado, usuario, origen, motivo, base, fechaCreacion, fechaActualizacion, historial });
  }
  for (const item of solicitudes) {
    await db.run(
      `INSERT INTO solicitudes(fecha_creacion, fecha_actualizacion, creador_id, estado, job, id_muestra, analito, origen_id, motivo_id, observaciones, snapshot_datos, historial_cambios)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      item.fechaCreacion.toISOString(),
      item.fechaActualizacion.toISOString(),
      item.usuario.id,
      item.estado,
      item.base.job,
      item.base.id_muestra,
      item.base.analito,
      item.origen.id,
      item.motivo.id,
      `Observaciones iniciales ${item.base.job}`,
      JSON.stringify(item.base),
      JSON.stringify(item.historial)
    );
  }
}

async function recalcularContadores(db) {
  await db.run('UPDATE origenes SET contador_uso = (SELECT COUNT(1) FROM solicitudes s WHERE s.origen_id = origenes.id)');
  await db.run('UPDATE motivos SET contador_uso = (SELECT COUNT(1) FROM solicitudes s WHERE s.motivo_id = motivos.id)');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
