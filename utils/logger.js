class Logger {
  log(level, operation, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      operation,
      message,
      ...data
    };

    const logString = `[${timestamp}] [${level.toUpperCase()}] [${operation}] - ${message}`;
    
    if (level === 'error') {
      console.error(logString, data);
    } else {
      console.log(logString, data.details ? data.details : '');
    }

    return logEntry;
  }

  info(operation, message, data) {
    return this.log('info', operation, message, data);
  }

  error(operation, message, data) {
    return this.log('error', operation, message, data);
  }

  warn(operation, message, data) {
    return this.log('warn', operation, message, data);
  }

  debug(operation, message, data) {
    if (process.env.NODE_ENV === 'development') {
      return this.log('debug', operation, message, data);
    }
  }
}

module.exports = new Logger();