import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { APP_CONFIG } from './config.js';

let dbInstance;

export async function getDb() {
  if (!dbInstance) {
    const dbPath = path.resolve(APP_CONFIG.dbFile);
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    dbInstance = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    await dbInstance.exec('PRAGMA foreign_keys = ON');
  }
  return dbInstance;
}

export async function closeDb() {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}
