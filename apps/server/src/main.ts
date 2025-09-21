import type { ConnectionOptions } from 'bullmq';
import express, { json, raw, type Express, type Request, type Response } from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';

import { load_environment_variables, get_server_config } from './config/environment';
import { establish_ngrok_tunnel, type NgrokTunnelHandle } from './infra/ngrok_tunnel';
import { build_line_webhook_router } from './line/line_webhook_router';
import { LineResponder } from './line/line_responder';
import { root_logger, log_function_entry, log_function_error, log_function_success } from './logger';
import { TaskRepository } from './persistence/task_repository';
import { ReminderDispatcher } from './reminders/reminder_dispatcher';
import { ReminderScheduler } from './reminders/reminder_scheduler';
import { create_trpc_context } from './trpc/context';
import { app_router } from './trpc/router';
import { GeminiClient } from './ai/gemini_client';
import { TaskAiAssistant } from './ai/task_ai_assistant';

/**
 * Bootstrap the HTTP server, wiring configuration, persistence, LINE webhook, ngrok tunneling, and tRPC routes.
 * @returns {Promise<void>} Resolves when the HTTP server is listening.
 */
async function bootstrap_server(): Promise<void> {
  const function_name = 'bootstrap_server';
  log_function_entry(root_logger, function_name);

  try {
    load_environment_variables();
    const server_config = get_server_config();
    const redis_connection_options = build_redis_connection_options(server_config.redis_url);

    const task_repository = new TaskRepository({
      connection_uri: server_config.mongodb_uri,
      database_name: server_config.mongodb_database_name,
      enable_offline_fallback: server_config.enable_offline_task_repository_fallback
    });
    await task_repository.connect();

    const reminder_dispatcher = new ReminderDispatcher({
      api_base_url: server_config.line_api_base_url,
      channel_access_token: server_config.line_channel_access_token,
      closing_phrase: 'Are you statisfied, habibi?'
    });

    const reminder_scheduler = new ReminderScheduler({
      connection: redis_connection_options,
      reminder_dispatcher,
      enable_offline_fallback: server_config.enable_offline_reminder_scheduler_fallback
    });
    await reminder_scheduler.initialize();

    const gemini_client = server_config.enable_ai_responses && server_config.gemini_api_key
      ? new GeminiClient({
          api_key: server_config.gemini_api_key,
          model: server_config.gemini_model ?? 'gemini-1.5-flash',
          api_base_url: server_config.gemini_api_base_url
        })
      : undefined;

    const task_ai_assistant = gemini_client
      ? new TaskAiAssistant({ gemini_client })
      : undefined;

    const line_responder = server_config.enable_ai_responses
      ? new LineResponder({
          api_base_url: server_config.line_api_base_url,
          channel_access_token: server_config.line_channel_access_token
        })
      : undefined;

    const express_app = express();
    register_health_route(express_app);

    const line_webhook_router = build_line_webhook_router({
      channel_secret: server_config.line_channel_secret,
      task_repository,
      reminder_scheduler,
      reminder_offset_minutes: server_config.default_reminder_offset_minutes,
      line_responder,
      task_ai_assistant
    });

    express_app.use('/line/webhook', raw({ type: '*/*' }), line_webhook_router);
    express_app.use(json());

    express_app.use(
      '/trpc',
      createExpressMiddleware({
        router: app_router,
        createContext: () => generate_trpc_context(task_repository)
      })
    );

    await start_http_server(express_app, server_config.http_port, server_config.node_environment);

    let ngrok_tunnel_handle: NgrokTunnelHandle | undefined;

    if (server_config.enable_ngrok_tunnel) {
      root_logger.info(
        {
          event: 'ngrok_tunnel_requested',
          http_port: server_config.http_port,
          ngrok_domain: server_config.ngrok_domain,
          ngrok_region: server_config.ngrok_region
        },
        'Attempting to establish ngrok tunnel'
      );

      ngrok_tunnel_handle = await establish_ngrok_tunnel({
        http_port: server_config.http_port,
        authtoken: server_config.ngrok_authtoken,
        domain: server_config.ngrok_domain,
        region: server_config.ngrok_region
      });

      if (ngrok_tunnel_handle) {
        root_logger.info(
          {
            event: 'ngrok_tunnel_established',
            public_url: ngrok_tunnel_handle.public_url
          },
          'Ngrok tunnel established'
        );
      } else {
        root_logger.warn(
          {
            event: 'ngrok_module_unavailable'
          },
          'Ngrok module not available; skipping tunnel setup'
        );
      }
    }

    /**
     * Gracefully shut down the HTTP server and disconnect dependencies on termination signals.
     * @returns {Promise<void>} Resolves when cleanup completes.
     */
    const shutdown = async (): Promise<void> => {
      const shutdown_function_name = 'shutdown_handler';
      log_function_entry(root_logger, shutdown_function_name);
      await task_repository.disconnect();
      await reminder_scheduler.shutdown();
      if (ngrok_tunnel_handle) {
        await ngrok_tunnel_handle.disconnect();
      }
      log_function_success(root_logger, shutdown_function_name);
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    log_function_success(root_logger, function_name);
  } catch (error) {
    log_function_error(root_logger, 'bootstrap_server', error);
    process.exit(1);
  }
}

/**
 * Build BullMQ connection options from a Redis connection string.
 * @param {string} redis_url Redis connection string.
 * @returns {ConnectionOptions} Parsed connection options suitable for BullMQ.
 */
function build_redis_connection_options(redis_url: string): ConnectionOptions {
  const function_name = 'build_redis_connection_options';
  log_function_entry(root_logger, function_name);

  const parsed_url = new URL(redis_url);
  const redis_port = parsed_url.port ? Number(parsed_url.port) : 6379;
  const normalized_path = parsed_url.pathname.replace(/^\//, '');
  const parsed_db = normalized_path ? Number(normalized_path) : undefined;

  const connection_options: ConnectionOptions = {
    host: parsed_url.hostname,
    port: redis_port
  };

  if (parsed_url.username) {
    connection_options.username = parsed_url.username;
  }

  if (parsed_url.password) {
    connection_options.password = parsed_url.password;
  }

  if (parsed_db !== undefined && Number.isFinite(parsed_db)) {
    connection_options.db = parsed_db;
  }

  if (parsed_url.protocol === 'rediss:') {
    connection_options.tls = {};
  }

  log_function_success(root_logger, function_name, {
    host: parsed_url.hostname,
    port: redis_port,
    db: connection_options.db ?? 0,
    tls_enabled: parsed_url.protocol === 'rediss:'
  });
  return connection_options;
}

/**
 * Register a simple health-check endpoint for readiness probing.
 * @param {Express} express_app Express application instance to mutate.
 * @returns {void}
 */
function register_health_route(express_app: Express): void {
  const function_name = 'register_health_route';
  log_function_entry(root_logger, function_name);

  const healthz_handler = (request: Request, response: Response): void => {
    const handler_function_name = 'healthz_handler';
    log_function_entry(root_logger, handler_function_name);

    response.json({ status: 'ok' });

    log_function_success(root_logger, handler_function_name);
  };

  express_app.get('/healthz', healthz_handler);

  log_function_success(root_logger, function_name);
}

/**
 * Build the tRPC context with instrumentation for middleware integration.
 * @param {TaskRepository} task_repository Repository instance to inject.
 * @returns {ReturnType<typeof create_trpc_context>} tRPC context object.
 */
function generate_trpc_context(
  task_repository: TaskRepository
): ReturnType<typeof create_trpc_context> {
  const function_name = 'generate_trpc_context';
  log_function_entry(root_logger, function_name);

  const context = create_trpc_context(task_repository);

  log_function_success(root_logger, function_name);
  return context;
}

/**
 * Start the HTTP server and emit structured logs once listening.
 * @param {Express} express_app Configured Express application instance.
 * @param {number} http_port Port for incoming traffic.
 * @param {string} node_environment Active NODE_ENV value for telemetry.
 * @returns {Promise<void>} Resolves after the server begins listening.
 */
async function start_http_server(
  express_app: Express,
  http_port: number,
  node_environment: string
): Promise<void> {
  const function_name = 'start_http_server';
  log_function_entry(root_logger, function_name, { http_port, node_environment });

  await new Promise<void>((resolve) => {
    const listen_callback = (): void => {
      const callback_function_name = 'listen_callback';
      log_function_entry(root_logger, callback_function_name, { http_port, node_environment });
      root_logger.info(
        {
          event: 'server_started',
          http_port,
          node_environment
        },
        'HTTP server running'
      );
      log_function_success(root_logger, callback_function_name, { http_port, node_environment });
      resolve();
    };

    express_app.listen(http_port, listen_callback);
  });

  log_function_success(root_logger, function_name, { http_port, node_environment });
}

void bootstrap_server();
