import { resolveSession } from '../../modules/usuarios/service.js';
import { unauthorized } from '../utils/errors.js';

export async function sessionMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  const user = await resolveSession(token);
  if (!user) {
    req.user = null;
    return next();
  }
  req.user = user;
  req.token = token;
  next();
}

export function requireAuth(required = true) {
  return (req, res, next) => {
    if (!required) {
      return next();
    }
    if (!req.user) {
      return next(unauthorized());
    }
    return next();
  };
}

function extractToken(req) {
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  if (req.cookies && req.cookies['session_token']) {
    return req.cookies['session_token'];
  }
  return null;
}
