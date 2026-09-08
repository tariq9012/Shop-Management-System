// Wraps an async route handler so thrown errors/rejected promises reach
// the centralized error handler instead of crashing the process or hanging.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// 404 handler — mounted after all routes
function notFound(req, res, next) {
  res.status(404).json({ msg: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Centralized error handler — mounted last, after everything else
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ msg: 'That record already exists' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({ msg: 'Referenced record does not exist' });
  }

  const status = err.status || 500;
  res.status(status).json({ msg: err.message || 'Something went wrong' });
}

module.exports = { asyncHandler, notFound, errorHandler };
