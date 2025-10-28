export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || 500;
  const payload = err.payload || { message: 'Internal Server Error' };
  if (status >= 500) {
    console.error('ERROR', err);
  }
  res.status(status).json(payload);
}
