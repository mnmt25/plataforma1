import fs from 'fs';
import path from 'path';
import { APP_CONFIG } from '../core/config.js';

const dbPath = path.resolve(APP_CONFIG.dbFile);
if (fs.existsSync(dbPath)) {
  fs.rmSync(dbPath);
}
if (fs.existsSync(APP_CONFIG.seedFlagFile)) {
  fs.rmSync(APP_CONFIG.seedFlagFile);
}
console.log('Base de datos reiniciada.');
