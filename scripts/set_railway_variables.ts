import { spawn } from 'child_process';
import { resolve } from 'path';

import { config as load_dotenv } from 'dotenv';

import {
  log_function_entry,
  log_function_error,
  log_function_success,
  root_logger
} from '../apps/server/src/logger';

interface RailwayVariableDefinition {
  readonly key: string;
  readonly env_keys: ReadonlyArray<string>;
  readonly default_value?: string;
  readonly required: boolean;
  readonly sensitive?: boolean;
  readonly description: string;
}

interface ResolvedRailwayVariable {
  readonly key: string;
  readonly value: string;
  readonly source: string;
  readonly sensitive: boolean;
  readonly used_default: boolean;
}

interface RailwayCliOptions {
  readonly service_name?: string;
  readonly environment_name?: string;
  readonly skip_deploys: boolean;
}

const script_logger = root_logger.child({ component: 'set_railway_variables_script' });

load_environment_files();

void main();

/**
 * Load environment variables from known dotenv files to make them available for the script execution.
 * @returns {void}
 */
function load_environment_files(): void {
  const function_name = 'load_environment_files';
  log_function_entry(script_logger, function_name);

  const candidate_files = [
    '.env.railway',
    '.env.production',
    '.env'
  ];

  for (const candidate_file of candidate_files) {
    load_dotenv({ path: resolve(process.cwd(), candidate_file), override: false });
  }

  log_function_success(script_logger, function_name, { candidate_files });
}

/**
 * Orchestrate the resolution and submission of Railway environment variables via the Railway CLI.
 * @returns {Promise<void>} Resolves when the CLI invocation completes successfully.
 */
async function main(): Promise<void> {
  const function_name = 'main';
  log_function_entry(script_logger, function_name);

  try {
    const variables = resolve_variables(build_variable_definitions());
    const cli_options = resolve_cli_options();
    await invoke_railway_cli(variables, cli_options);
    log_function_success(script_logger, function_name, {
      variables_count: variables.length,
      service_name: cli_options.service_name,
      environment_name: cli_options.environment_name
    });
  } catch (error) {
    log_function_error(script_logger, function_name, error);
    process.exitCode = 1;
  }
}

/**
 * Resolve the Railway CLI options from environment variables to keep the script configurable.
 * @returns {RailwayCliOptions} Parsed Railway CLI options.
 */
function resolve_cli_options(): RailwayCliOptions {
  const function_name = 'resolve_cli_options';
  log_function_entry(script_logger, function_name);

  const options: RailwayCliOptions = {
    service_name: process.env.RAILWAY_SERVICE_NAME,
    environment_name: process.env.RAILWAY_ENVIRONMENT_NAME,
    skip_deploys: (process.env.RAILWAY_SKIP_DEPLOYS ?? 'false').toLowerCase() === 'true'
  };

  log_function_success(script_logger, function_name, {
    service_name: options.service_name,
    environment_name: options.environment_name,
    skip_deploys: options.skip_deploys
  });
  return options;
}

/**
 * Build the list of environment variables that must be applied to the Railway service.
 * @returns {ReadonlyArray<RailwayVariableDefinition>} Variable definitions describing required values.
 */
function build_variable_definitions(): ReadonlyArray<RailwayVariableDefinition> {
  const function_name = 'build_variable_definitions';
  log_function_entry(script_logger, function_name);

  const definitions: ReadonlyArray<RailwayVariableDefinition> = [
    {
      key: 'NODE_ENV',
      env_keys: ['RAILWAY_NODE_ENV', 'NODE_ENV'],
      default_value: 'production',
      required: true,
      description: 'Execution environment for the Node.js process.'
    },
    {
      key: 'HTTP_PORT',
      env_keys: ['RAILWAY_HTTP_PORT', 'HTTP_PORT'],
      default_value: '8080',
      required: false,
      description: 'Incoming HTTP port; Railway injects PORT automatically, but the app reads HTTP_PORT.'
    },
    {
      key: 'MONGODB_URI',
      env_keys: ['RAILWAY_MONGODB_URI', 'MONGODB_URI'],
      default_value: 'memory://tasks',
      required: true,
      description: 'MongoDB connection string or memory:// URI for in-memory fallback.'
    },
    {
      key: 'MONGODB_DATABASE_NAME',
      env_keys: ['RAILWAY_MONGODB_DATABASE_NAME', 'MONGODB_DATABASE_NAME'],
      default_value: 'mr_leo_class',
      required: true,
      description: 'MongoDB database name used by the task repository.'
    },
    {
      key: 'ENABLE_OFFLINE_TASK_REPOSITORY_FALLBACK',
      env_keys: ['ENABLE_OFFLINE_TASK_REPOSITORY_FALLBACK'],
      default_value: 'true',
      required: true,
      description: 'Enable in-memory fallback for the task repository when MongoDB is unavailable.'
    },
    {
      key: 'REDIS_URL',
      env_keys: ['RAILWAY_REDIS_URL', 'REDIS_URL'],
      default_value: 'redis://localhost:6379',
      required: true,
      description: 'Redis connection string or a pseudo-URL for in-memory fallback mode.'
    },
    {
      key: 'ENABLE_OFFLINE_REMINDER_SCHEDULER_FALLBACK',
      env_keys: ['ENABLE_OFFLINE_REMINDER_SCHEDULER_FALLBACK'],
      default_value: 'true',
      required: true,
      description: 'Enable in-memory fallback for the reminder scheduler when Redis is unavailable.'
    },
    {
      key: 'LINE_CHANNEL_SECRET',
      env_keys: ['RAILWAY_LINE_CHANNEL_SECRET', 'LINE_CHANNEL_SECRET'],
      default_value: 'placeholder_line_channel_secret',
      required: true,
      sensitive: true,
      description: 'LINE messaging API channel secret.'
    },
    {
      key: 'LINE_CHANNEL_ACCESS_TOKEN',
      env_keys: ['RAILWAY_LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CHANNEL_ACCESS_TOKEN'],
      default_value: 'placeholder_line_channel_access_token',
      required: true,
      sensitive: true,
      description: 'LINE messaging API channel access token.'
    }
  ];

  log_function_success(script_logger, function_name, { definitions_count: definitions.length });
  return definitions;
}

/**
 * Resolve variable definitions into concrete values taken from the environment or defaults.
 * @param {ReadonlyArray<RailwayVariableDefinition>} definitions Variable definitions to resolve.
 * @returns {ResolvedRailwayVariable[]} Resolved variable payloads ready for submission.
 */
function resolve_variables(
  definitions: ReadonlyArray<RailwayVariableDefinition>
): ResolvedRailwayVariable[] {
  const function_name = 'resolve_variables';
  log_function_entry(script_logger, function_name, { definitions_count: definitions.length });

  const resolved_variables: ResolvedRailwayVariable[] = [];

  for (const definition of definitions) {
    const resolution = resolve_variable(definition);
    resolved_variables.push(resolution);
  }

  log_function_success(script_logger, function_name, { variables_count: resolved_variables.length });
  return resolved_variables;
}

/**
 * Resolve a single variable definition into a value.
 * @param {RailwayVariableDefinition} definition Variable definition to resolve.
 * @returns {ResolvedRailwayVariable} Resolved variable including provenance metadata.
 */
function resolve_variable(definition: RailwayVariableDefinition): ResolvedRailwayVariable {
  const function_name = 'resolve_variable';
  log_function_entry(script_logger, function_name, { key: definition.key });

  for (const env_key of definition.env_keys) {
    const env_value = process.env[env_key];
    if (typeof env_value === 'string' && env_value.length > 0) {
      log_function_success(script_logger, function_name, {
        key: definition.key,
        source: env_key,
        sensitive: definition.sensitive === true
      });

      return {
        key: definition.key,
        value: env_value,
        source: env_key,
        sensitive: definition.sensitive === true,
        used_default: false
      };
    }
  }

  if (definition.default_value !== undefined) {
    log_function_success(script_logger, function_name, {
      key: definition.key,
      source: 'default_value',
      sensitive: definition.sensitive === true
    });

    return {
      key: definition.key,
      value: definition.default_value,
      source: 'default_value',
      sensitive: definition.sensitive === true,
      used_default: true
    };
  }

  if (definition.required) {
    const error = new Error(`Missing required environment variable for ${definition.key}`);
    log_function_error(script_logger, function_name, error, { key: definition.key });
    throw error;
  }

  log_function_success(script_logger, function_name, {
    key: definition.key,
    source: 'skipped_optional',
    sensitive: definition.sensitive === true
  });

  return {
    key: definition.key,
    value: '',
    source: 'skipped_optional',
    sensitive: definition.sensitive === true,
    used_default: false
  };
}

/**
 * Invoke the Railway CLI with the resolved variables.
 * @param {ReadonlyArray<ResolvedRailwayVariable>} variables Variables to apply remotely.
 * @param {RailwayCliOptions} options CLI options including service and environment selectors.
 * @returns {Promise<void>} Resolves when the CLI terminates successfully.
 */
async function invoke_railway_cli(
  variables: ReadonlyArray<ResolvedRailwayVariable>,
  options: RailwayCliOptions
): Promise<void> {
  const function_name = 'invoke_railway_cli';
  log_function_entry(script_logger, function_name, {
    variables_count: variables.length,
    skip_deploys: options.skip_deploys
  });

  if (variables.length === 0) {
    log_function_success(script_logger, function_name, { message: 'No variables to set.' });
    return;
  }

  const cli_arguments: string[] = ['variables'];

  if (options.service_name) {
    cli_arguments.push('--service', options.service_name);
  }

  if (options.environment_name) {
    cli_arguments.push('--environment', options.environment_name);
  }

  for (const variable of variables) {
    if (variable.source === 'skipped_optional') {
      continue;
    }
    cli_arguments.push('--set', `${variable.key}=${variable.value}`);
  }

  if (options.skip_deploys) {
    cli_arguments.push('--skip-deploys');
  }

  await execute_cli(cli_arguments);

  log_function_success(script_logger, function_name, {
    variables_count: variables.length,
    skip_deploys: options.skip_deploys
  });
}

/**
 * Spawn the Railway CLI process with the provided arguments and stream output to the parent process.
 * @param {ReadonlyArray<string>} cli_arguments Arguments passed to the Railway CLI.
 * @returns {Promise<void>} Resolves when the CLI exits with status code zero.
 */
function execute_cli(cli_arguments: ReadonlyArray<string>): Promise<void> {
  const function_name = 'execute_cli';
  const sanitized_arguments = sanitize_cli_arguments(cli_arguments);
  log_function_entry(script_logger, function_name, { cli_arguments: sanitized_arguments });

  return new Promise((resolve_cli, reject_cli) => {
    const railway_process = spawn('railway', cli_arguments, {
      stdio: 'inherit'
    });

    railway_process.on('close', (exit_code) => {
      if (exit_code === 0) {
        log_function_success(script_logger, function_name, { exit_code });
        resolve_cli();
        return;
      }

      const error = new Error(`Railway CLI exited with status ${exit_code}`);
      log_function_error(script_logger, function_name, error, { exit_code });
      reject_cli(error);
    });

    railway_process.on('error', (error) => {
      log_function_error(script_logger, function_name, error);
      reject_cli(error);
    });
  });
}

/**
 * Redact sensitive values from CLI arguments before emitting logs.
 * @param {ReadonlyArray<string>} cli_arguments CLI arguments to sanitize for logging.
 * @returns {string[]} Sanitized CLI arguments safe for structured logging.
 */
function sanitize_cli_arguments(cli_arguments: ReadonlyArray<string>): string[] {
  const function_name = 'sanitize_cli_arguments';
  log_function_entry(script_logger, function_name);

  const sanitized_arguments: string[] = [];

  for (let index = 0; index < cli_arguments.length; index += 1) {
    const argument = cli_arguments[index];
    if (argument === '--set') {
      const value_argument = cli_arguments[index + 1];
      if (typeof value_argument === 'string') {
        const [key] = value_argument.split('=', 1);
        sanitized_arguments.push(argument, `${key}=<redacted>`);
        index += 1;
        continue;
      }
    }

    sanitized_arguments.push(argument);
  }

  log_function_success(script_logger, function_name, { sanitized_arguments });
  return sanitized_arguments;
}
