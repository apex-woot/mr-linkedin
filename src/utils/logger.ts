/**
 * Standardized Logging Utilities
 *
 * Provides consistent logging interface with standard Unicode symbols.
 * Centralizes console output formatting across all scrapers.
 */

type LogLevel = 'debug' | 'info' | 'success' | 'warn' | 'error' | 'skip'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  success: 1,
  skip: 1,
  warn: 2,
  error: 3,
}

// Default level is info unless specified in environment
const DEFAULT_LEVEL = (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || 'info'
const currentLevelPriority = LOG_LEVELS[DEFAULT_LEVEL] ?? LOG_LEVELS.info

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= currentLevelPriority
}

export const log = {
  /**
   * General info information
   */
  info: (message: string): void => {
    if (shouldLog('info')) console.info(message)
  },

  /**
   * General debug information
   */
  debug: (message: string): void => {
    if (shouldLog('debug')) console.debug(message)
  },

  /**
   * Successful operation (✓)
   */
  success: (message: string): void => {
    if (shouldLog('success')) console.info(`✓ ${message}`)
  },

  /**
   * Warning message (⚠)
   */
  warning: (message: string): void => {
    if (shouldLog('warn')) console.warn(`⚠ ${message}`)
  },

  /**
   * Error message (✗)
   */
  error: (message: string): void => {
    if (shouldLog('error')) console.error(`✗ ${message}`)
  },

  /**
   * Skipped operation (⊳)
   */
  skip: (message: string): void => {
    if (shouldLog('skip')) console.debug(`⊳ ${message}`)
  },
}
