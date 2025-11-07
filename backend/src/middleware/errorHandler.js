const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  logger.error('Error:', err.message);
  
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: {
      message: err.message || 'An error occurred',
      status: status
    }
  });
}

module.exports = errorHandler;