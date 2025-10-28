export function createError(status, payload) {
  const err = new Error(payload.code || 'ERROR');
  err.status = status;
  err.payload = payload;
  return err;
}

export function unauthorized() {
  return createError(401, { code: 'UNAUTHORIZED' });
}

export function forbidden(action) {
  return createError(403, { code: 'FORBIDDEN', accion: action });
}

export function notFound(entity, id) {
  return createError(404, { code: 'NOT_FOUND', entidad: entity, id });
}

export function conflict(motivo) {
  return createError(409, { code: 'CONFLICT', motivo });
}

export function limitExceeded(limite, sugerencia) {
  return createError(400, { code: 'LIMIT_EXCEEDED', limite, sugerencia });
}
