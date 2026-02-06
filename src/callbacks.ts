import fs from 'node:fs/promises'
import { log as logger } from './utils/logger'

export interface ProgressCallback {
  onStart(type: string, url: string): Promise<void> | void
  onComplete(type: string, data: any): Promise<void> | void
  onInfo(message: string): Promise<void> | void
  onWarning(message: string): Promise<void> | void
  onError(message: string, error?: Error): Promise<void> | void
}

/**
 * Factory function to create a silent callback that does nothing
 * @returns ProgressCallback that ignores all events
 */
export function createSilentCallback(): ProgressCallback {
  return {
    onStart: (_type: string, _url: string) => {},
    onComplete: (_type: string, _data: any) => {},
    onInfo: (_message: string) => {},
    onWarning: (_message: string) => {},
    onError: (_message: string, _error?: Error) => {},
  }
}

/**
 * Factory function to create a console callback that logs via the standard logger
 * @returns ProgressCallback that logs to console
 */
export function createConsoleCallback(): ProgressCallback {
  return {
    onStart: (type: string, url: string) => {
      logger.info(`Starting ${type} scraping: ${url}`)
    },
    onComplete: (type: string, _data: any) => {
      logger.success(`Completed ${type} scraping successfully`)
    },
    onInfo: (message: string) => {
      logger.info(message)
    },
    onWarning: (message: string) => {
      logger.warning(message)
    },
    onError: (message: string, error?: Error) => {
      logger.error(`${message}${error ? ` - ${error.message}` : ''}`)
    },
  }
}

/**
 * Factory function to create a JSON log callback that writes events to a file
 * @param logFile - Path to the log file
 * @returns ProgressCallback that writes JSON logs
 */
export function createJSONLogCallback(logFile: string): ProgressCallback {
  async function logToFile(eventType: string, data: any): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      event_type: eventType,
      ...data,
    }

    try {
      await fs.appendFile(logFile, `${JSON.stringify(entry)}\n`)
    } catch (e) {
      logger.error(`Failed to write to log file: ${e}`)
    }
  }

  return {
    onStart: async (type: string, url: string) => {
      await logToFile('start', { scraper_type: type, url })
    },
    onComplete: async (type: string, _data: any) => {
      await logToFile('complete', { scraper_type: type })
    },
    onInfo: async (message: string) => {
      await logToFile('info', { message })
    },
    onWarning: async (message: string) => {
      await logToFile('warning', { message })
    },
    onError: async (message: string, error?: Error) => {
      await logToFile('error', {
        error: message,
        error_type: error?.name ?? 'Error',
        details: error?.message,
      })
    },
  }
}

/**
 * Factory function to create a multi callback that forwards events to multiple callbacks
 * @param callbacks - Array of callbacks to forward events to
 * @returns ProgressCallback that invokes all provided callbacks
 */
export function createMultiCallback(...callbacks: ProgressCallback[]): ProgressCallback {
  return {
    onStart: async (type: string, url: string) => {
      await Promise.all(callbacks.map((c) => c.onStart(type, url)))
    },
    onComplete: async (type: string, data: any) => {
      await Promise.all(callbacks.map((c) => c.onComplete(type, data)))
    },
    onInfo: async (message: string) => {
      await Promise.all(callbacks.map((c) => c.onInfo(message)))
    },
    onWarning: async (message: string) => {
      await Promise.all(callbacks.map((c) => c.onWarning(message)))
    },
    onError: async (message: string, error?: Error) => {
      await Promise.all(callbacks.map((c) => c.onError(message, error)))
    },
  }
}
