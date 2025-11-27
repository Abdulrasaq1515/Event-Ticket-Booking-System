const rateLimit = require('express-rate-limit');
const appConfig = require('../config/app');

let limiter;

if (appConfig.env === 'test' || !appConfig.enableRateLimiting) {
  limiter = (req, res, next) => next();
} else {
  limiter = rateLimit({
    windowMs: appConfig.rateLimitWindow,
    max: appConfig.rateLimitMax,
    message: {
      error: {
        message: 'Too many requests from this IP, please try again later.'
      }
    },
    standardHeaders: true,
    legacyHeaders: false
  });
}

module.exports = limiter;