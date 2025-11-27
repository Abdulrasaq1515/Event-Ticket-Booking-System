const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
    let statusCode = 500;
    let message = 'Internal server error';
    let details = null;

    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    } else if (err.code === 'ER_DUP_ENTRY') {
        statusCode = 409;
        message = 'Duplicate entry';
        details = err.sqlMessage;
    } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        statusCode = 400;
        message = 'Invalid reference';
        details = err.sqlMessage;
    }

    logger.error('ERROR', message, {
        statusCode,
        details: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method
    });

    res.status(statusCode).json({
        error: {
            message,
            ...(process.env.NODE_ENV === 'development' && {
                details: err.message,
                stack: err.stack
            })
        }
    });
};

module.exports = errorHandler;