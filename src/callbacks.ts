import fs from 'node:fs/promises'

export interface ProgressCallback {
  onStart(type: string, url: string): Promise<void> | void
  onProgress(message: string, percent: number): Promise<void> | void
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
    onProgress: (_message: string, _percent: number) => {},
    onComplete: (_type: string, _data: any) => {},
    onInfo: (_message: string) => {},
    onWarning: (_message: string) => {},
    onError: (_message: string, _error?: Error) => {},
  }
}

/**
 * Factory function to create a console callback that logs to stdout/stderr
 * @param verbose - Whether to show all progress updates or only milestones
 * @returns ProgressCallback that logs to console
 */
export function createConsoleCallback(verbose: boolean = true): ProgressCallback {
  return {
    onStart: (type: string, url: string) => {
      console.info(`Starting ${type} scraping: ${url}`)
    },
    onProgress: (message: string, percent: number) => {
      if (verbose || percent % 20 === 0) {
        const barLength = 30
        const filled = Math.floor((barLength * percent) / 100)
        const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled)
        console.log(`[${bar}] ${percent}% - ${message}`)
      }
    },
    onComplete: (type: string, _data: any) => {
      console.info(`Completed ${type} scraping successfully`)
    },
    onInfo: (message: string) => {
      console.info(`[Info] ${message}`)
    },
    onWarning: (message: string) => {
      console.warn(`[Warning] ${message}`)
    },
    onError: (message: string, error?: Error) => {
      console.error(`Error: ${message}`, error?.message ?? '')
    },
  }
}

/**
 * Factory function to create a JSON log callback that writes events to a file
 * @param logFile - Path to the log file
 * @returns ProgressCallback that writes JSON logs
 */
export function createJSONLogCallback(logFile: string): ProgressCallback {
  async function log(eventType: string, data: any): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      event_type: eventType,
      ...data,
    }

    try {
      await fs.appendFile(logFile, `${JSON.stringify(entry)}\n`)
    } catch (e) {
      console.error(`Failed to write to log file: ${e}`)
    }
  }

  return {
    onStart: async (type: string, url: string) => {
      await log('start', { scraper_type: type, url })
    },
    onProgress: async (message: string, percent: number) => {
      await log('progress', { message, percent })
    },
    onComplete: async (type: string, _data: any) => {
      await log('complete', { scraper_type: type })
    },
    onInfo: async (message: string) => {
      await log('info', { message })
    },
    onWarning: async (message: string) => {
      await log('warning', { message })
    },
    onError: async (message: string, error?: Error) => {
      await log('error', {
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
    onProgress: async (message: string, percent: number) => {
      await Promise.all(callbacks.map((c) => c.onProgress(message, percent)))
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

