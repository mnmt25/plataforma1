PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  hash_credencial TEXT NOT NULL,
  rol TEXT NOT NULL CHECK(rol IN ('admin','usuario')),
  area TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  ultimo_acceso TEXT
);

CREATE TABLE IF NOT EXISTS sesiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expiracion TEXT NOT NULL,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS origenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  nombre_normalizado TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  contador_uso INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS motivos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  nombre_normalizado TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  contador_uso INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bd_principal_simulada (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT,
  id_muestra TEXT,
  analito TEXT,
  cliente TEXT,
  proyecto TEXT,
  fecha_muestreo TEXT,
  responsable TEXT,
  datos_extra TEXT
);

CREATE TABLE IF NOT EXISTS solicitudes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_creacion TEXT NOT NULL,
  fecha_actualizacion TEXT NOT NULL,
  creador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  estado TEXT NOT NULL CHECK(estado IN ('borrador','en_revision','en_analisis','cerrado')),
  job TEXT,
  id_muestra TEXT,
  analito TEXT,
  origen_id INTEGER NOT NULL REFERENCES origenes(id) ON DELETE RESTRICT,
  motivo_id INTEGER NOT NULL REFERENCES motivos(id) ON DELETE RESTRICT,
  observaciones TEXT,
  snapshot_datos TEXT,
  historial_cambios TEXT
);

CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  fecha TEXT NOT NULL,
  accion TEXT NOT NULL CHECK(accion IN ('login','logout','crear','editar','eliminar','transicion_estado','exportar')),
  entidad TEXT NOT NULL,
  entidad_id INTEGER,
  detalle TEXT
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_estado_fecha ON solicitudes(estado, fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_solicitudes_origen ON solicitudes(origen_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_motivo ON solicitudes(motivo_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_creador ON solicitudes(creador_id);

