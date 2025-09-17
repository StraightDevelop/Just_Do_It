import type { Logger } from 'pino';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import pinoFactory = require('pino');

export interface StructuredLogContext {
  readonly context_id?: string;
  readonly [key: string]: unknown;
}

const transport_target = process.env.LOG_FORMAT === 'pretty'
  ? {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  : undefined;

export const root_logger = initialize_root_logger();

/**
 * Build the root pino logger with configuration driven by environment variables.
 * @returns {Logger} Configured root logger instance.
 */
function initialize_root_logger(): Logger {
  const provisional_logger = pinoFactory({
    level: process.env.LOG_LEVEL ?? 'info',
    transport: transport_target
  });

  provisional_logger.info(
    {
      event: 'function_entry',
      function_name: 'initialize_root_logger'
    },
    'Initializing root logger'
  );

  provisional_logger.info(
    {
      event: 'function_exit',
      function_name: 'initialize_root_logger'
    },
    'Initialized root logger'
  );

  return provisional_logger;
}

/**
 * Emit a structured entry log for a function invocation.
 * @param {Logger} logger Logger used for emission.
 * @param {string} function_name Name of the function being instrumented.
 * @param {StructuredLogContext} context Additional structured context including optional correlation identifiers.
 * @returns {void}
 */
export function log_function_entry(
  logger: Logger,
  function_name: string,
  context: StructuredLogContext = {}
): void {
  logger.debug(
    {
      event: 'function_entry',
      function_name: 'log_function_entry'
    },
    'Logging helper entry'
  );

  logger.info(
    {
      event: 'function_entry',
      function_name,
      ...context
    },
    'Function entry'
  );

  logger.debug(
    {
      event: 'function_exit',
      function_name: 'log_function_entry'
    },
    'Logging helper exit'
  );
}

/**
 * Emit a structured success log for a function completion.
 * @param {Logger} logger Logger used for emission.
 * @param {string} function_name Name of the function being instrumented.
 * @param {StructuredLogContext} context Additional structured context including optional correlation identifiers.
 * @returns {void}
 */
export function log_function_success(
  logger: Logger,
  function_name: string,
  context: StructuredLogContext = {}
): void {
  logger.debug(
    {
      event: 'function_entry',
      function_name: 'log_function_success'
    },
    'Logging helper entry'
  );

  logger.info(
    {
      event: 'function_exit',
      function_name,
      ...context
    },
    'Function completed'
  );

  logger.debug(
    {
      event: 'function_exit',
      function_name: 'log_function_success'
    },
    'Logging helper exit'
  );
}

/**
 * Emit a structured error log for a function failure.
 * @param {Logger} logger Logger used for emission.
 * @param {string} function_name Name of the function being instrumented.
 * @param {unknown} error Captured error object.
 * @param {StructuredLogContext} context Additional structured context including optional correlation identifiers.
 * @returns {void}
 */
export function log_function_error(
  logger: Logger,
  function_name: string,
  error: unknown,
  context: StructuredLogContext = {}
): void {
  logger.debug(
    {
      event: 'function_entry',
      function_name: 'log_function_error'
    },
    'Logging helper entry'
  );

  logger.error(
    {
      event: 'function_error',
      function_name,
      error,
      ...context
    },
    'Function error'
  );

  logger.debug(
    {
      event: 'function_exit',
      function_name: 'log_function_error'
    },
    'Logging helper exit'
  );
}
