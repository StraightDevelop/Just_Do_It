import { config as load_dotenv } from 'dotenv';

import { log_function_entry, log_function_error, log_function_success, root_logger } from '../logger';

export interface ServerConfig {
  readonly node_environment: string;
  readonly http_port: number;
  readonly mongodb_uri: string;
  readonly mongodb_database_name: string;
  readonly line_channel_secret: string;
  readonly line_channel_access_token: string;
  readonly default_reminder_offset_minutes: number;
}

let cached_config: ServerConfig | undefined;

/**
 * Load environment variables from the process environment and optional .env file.
 * @param {string | undefined} env_file_path Optional path to an environment file for dotenv to parse.
 * @returns {void}
 */
export function load_environment_variables(env_file_path?: string): void {
  const function_name = 'load_environment_variables';
  log_function_entry(root_logger, function_name, { env_file_path });

  if (env_file_path) {
    load_dotenv({ path: env_file_path });
  } else {
    load_dotenv();
  }

  log_function_success(root_logger, function_name, { env_file_path });
}

/**
 * Build and cache the server configuration derived from environment variables.
 * @returns {ServerConfig} Normalized server configuration object.
 */
export function get_server_config(): ServerConfig {
  const function_name = 'get_server_config';
  log_function_entry(root_logger, function_name);

  if (cached_config) {
    log_function_success(root_logger, function_name, { cache_hit: true });
    return cached_config;
  }

  const node_environment = process.env.NODE_ENV ?? 'development';
  const http_port = Number(process.env.HTTP_PORT ?? 8080);
  const mongodb_uri = process.env.MONGODB_URI ?? '';
  const mongodb_database_name = process.env.MONGODB_DATABASE_NAME ?? 'mr_leo_class';
  const line_channel_secret = process.env.LINE_CHANNEL_SECRET ?? '';
  const line_channel_access_token = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '';
  const parsed_offset = Number(process.env.DEFAULT_REMINDER_OFFSET_MINUTES ?? 10);
  const default_reminder_offset_minutes = Number.isFinite(parsed_offset) ? parsed_offset : 10;

  if (!mongodb_uri) {
    const error = new Error('Missing MONGODB_URI environment variable');
    log_function_error(root_logger, function_name, error);
    throw error;
  }

  if (!line_channel_secret) {
    const error = new Error('Missing LINE_CHANNEL_SECRET environment variable');
    log_function_error(root_logger, function_name, error);
    throw error;
  }

  if (!line_channel_access_token) {
    const error = new Error('Missing LINE_CHANNEL_ACCESS_TOKEN environment variable');
    log_function_error(root_logger, function_name, error);
    throw error;
  }

  cached_config = {
    node_environment,
    http_port,
    mongodb_uri,
    mongodb_database_name,
    line_channel_secret,
    line_channel_access_token,
    default_reminder_offset_minutes
  };

  log_function_success(root_logger, function_name, {
    cache_hit: false,
    default_reminder_offset_minutes
  });
  return cached_config;
}
