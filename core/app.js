import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { APP_CONFIG } from './config.js';
import { sessionMiddleware } from './middleware/session.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from '../modules/usuarios/controller.js';
import { catalogosRouter } from '../modules/catalogos/controller.js';
import { solicitudesRouter } from '../modules/solicitudes/controller.js';
import { auditoriaRouter } from '../modules/auditoria/controller.js';
import { bdpRouter } from '../modules/bd_principal_simulada/controller.js';
import { exportRouter } from '../modules/export/controller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(sessionMiddleware);

  app.use('/api', authRouter);
  app.use('/api/catalogos', catalogosRouter);
  app.use('/api/solicitudes', solicitudesRouter);
  app.use('/api/auditoria', auditoriaRouter);
  app.use('/api/bdp', bdpRouter);
  app.use('/api/export', exportRouter);

  const uiPath = path.resolve(__dirname, '../ui');
  const assetsPath = path.resolve(__dirname, '../assets');
  app.use('/assets', express.static(assetsPath));
  app.use(express.static(uiPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(uiPath, 'index.html'));
  });

  app.use(errorHandler);

  return app;
}
