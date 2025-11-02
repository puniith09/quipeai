const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  error: (...args: unknown[]) => {
    console.error(...args);
  },

  debug: (emoji: string, label: string, data?: unknown) => {
    if (isDevelopment) {
      if (data !== undefined) {
        console.log(`${emoji} ${label}:`, data);
      } else {
        console.log(`${emoji} ${label}`);
      }
    }
  },

  group: (label: string, callback: () => void) => {
    if (isDevelopment) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  },

  table: (data: unknown) => {
    if (isDevelopment) {
      console.table(data);
    }
  },
};
