import { existsSync } from 'fs';
import path from 'path';

import { config as load_dotenv } from 'dotenv';

import { log_function_entry, log_function_error, log_function_success, root_logger } from '../logger';

export interface ServerConfig {
  readonly node_environment: string;
  readonly http_port: number;
  readonly mongodb_uri: string;
  readonly mongodb_database_name: string;
  readonly line_channel_secret: string;
  readonly line_channel_access_token: string;
  readonly line_api_base_url: string;
  readonly redis_url: string;
  readonly default_reminder_offset_minutes: number;
  readonly enable_ngrok_tunnel: boolean;
  readonly ngrok_authtoken?: string;
  readonly ngrok_domain?: string;
  readonly ngrok_region?: string;
  readonly enable_ai_responses: boolean;
  readonly gemini_api_key?: string;
  readonly gemini_model?: string;
  readonly gemini_api_base_url?: string;
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
    const candidate_paths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), '..', '.env'),
      path.resolve(process.cwd(), '..', '..', '.env'),
      path.resolve(process.cwd(), '..', '..', '..', '.env'),
      path.resolve(__dirname, '..', '..', '..', '..', '.env')
    ];

    const discovered_path = candidate_paths.find((candidate_path) => existsSync(candidate_path));

    if (discovered_path) {
      load_dotenv({ path: discovered_path });
    } else {
      load_dotenv();
    }
  }

  log_function_success(root_logger, function_name, { env_file_path: env_file_path ?? 'auto' });
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
  const redis_url = process.env.REDIS_URL ?? '';
  const line_api_base_url = process.env.LINE_API_BASE_URL ?? 'https://api.line.me';
  const parsed_offset = Number(process.env.DEFAULT_REMINDER_OFFSET_MINUTES ?? 10);
  const default_reminder_offset_minutes = Number.isFinite(parsed_offset) ? parsed_offset : 10;
  const enable_ngrok_tunnel = (process.env.ENABLE_NGROK_TUNNEL ?? 'false').toLowerCase() === 'true';
  const ngrok_authtoken = process.env.NGROK_AUTHTOKEN;
  const ngrok_domain = process.env.NGROK_DOMAIN;
  const ngrok_region = process.env.NGROK_REGION;
  const enable_ai_responses = (process.env.ENABLE_AI_RESPONSES ?? 'false').toLowerCase() === 'true';
  const gemini_api_key = process.env.GEMINI_API_KEY;
  const gemini_model = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
  const gemini_api_base_url = process.env.GEMINI_API_BASE_URL;

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

  if (!redis_url) {
    const error = new Error('Missing REDIS_URL environment variable');
    log_function_error(root_logger, function_name, error);
    throw error;
  }

  if (enable_ai_responses && !gemini_api_key) {
    const error = new Error('ENABLE_AI_RESPONSES is true but GEMINI_API_KEY is missing');
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
    line_api_base_url,
    redis_url,
    default_reminder_offset_minutes,
    enable_ngrok_tunnel,
    ngrok_authtoken,
    ngrok_domain,
    ngrok_region,
    enable_ai_responses,
    gemini_api_key,
    gemini_model,
    gemini_api_base_url
  };

  log_function_success(root_logger, function_name, {
    cache_hit: false,
    redis_url,
    line_api_base_url,
    default_reminder_offset_minutes,
    enable_ngrok_tunnel,
    ngrok_domain,
    ngrok_region,
    enable_ai_responses
  });
  return cached_config;
}
