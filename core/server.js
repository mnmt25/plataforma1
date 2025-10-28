import { createApp } from './app.js';
import { APP_CONFIG } from './config.js';

export function startServer() {
  const app = createApp();
  return app.listen(APP_CONFIG.port, () => {
    console.log(`Servidor iniciado en http://localhost:${APP_CONFIG.port}`);
  });
}
