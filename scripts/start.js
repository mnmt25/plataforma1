import { startServer } from '../core/server.js';
import { initDatabase } from './init-db.js';

async function main() {
  await initDatabase();
  startServer();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
