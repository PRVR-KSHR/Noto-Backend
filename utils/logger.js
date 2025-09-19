/**
 * Production-safe logging utility for backend
 * Only logs in development environment
 */

const isDevelopment = process.env.NODE_ENV !== 'production';
const level = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

const shouldLog = (lvl) => {
  const order = { error: 0, warn: 1, info: 2, debug: 3, log: 4 };
  const current = order[level] ?? 2;
  const incoming = order[lvl] ?? 2;
  return incoming <= current;
};

export const logger = {
  log: (...args) => { if (shouldLog('log')) console.log(...args); },
  
  error: (...args) => { console.error(...args); },
  
  warn: (...args) => { if (shouldLog('warn')) console.warn(...args); },
  
  info: (...args) => { if (shouldLog('info')) console.info(...args); },

  debug: (...args) => { if (shouldLog('debug')) console.debug(...args); },

  // Stream for morgan
  stream: {
    write: (message) => {
      if (shouldLog('info')) console.info(message.trim());
    }
  }
};

export default logger;