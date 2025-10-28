export const APP_CONFIG = {
  port: process.env.PORT ? Number(process.env.PORT) : 4000,
  sessionExpiryMinutes: process.env.SESSION_EXPIRY ? Number(process.env.SESSION_EXPIRY) : 120,
  exportRowLimit: process.env.EXPORT_ROW_LIMIT ? Number(process.env.EXPORT_ROW_LIMIT) : 50000,
  dbFile: process.env.DB_FILE || './db/recheck.db',
  seedFlagFile: './db/.seeded',
  localeDefault: 'es',
  locales: ['es', 'en']
};

export const SECURITY_CONFIG = {
  passwordMinLength: 10,
  tokenLength: 48,
  saltRounds: 10
};

export const UI_CONFIG = {
  title: 'Plataforma de Re-chequeo',
  description: 'Sistema interno de control de re-chequeo de muestras'
};
