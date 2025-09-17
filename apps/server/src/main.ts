import express, { json, raw, type Express, type Request, type Response } from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';

import { load_environment_variables, get_server_config } from './config/environment';
import { build_line_webhook_router } from './line/line_webhook_router';
import { root_logger, log_function_entry, log_function_error, log_function_success } from './logger';
import { TaskRepository } from './persistence/task_repository';
import { ReminderScheduler } from './reminders/reminder_scheduler';
import { create_trpc_context } from './trpc/context';
import { app_router } from './trpc/router';

/**
 * Bootstrap the HTTP server, wiring configuration, persistence, LINE webhook, and tRPC routes.
 * @returns {Promise<void>} Resolves when the HTTP server is listening.
 */
async function bootstrap_server(): Promise<void> {
  const function_name = 'bootstrap_server';
  log_function_entry(root_logger, function_name);

  try {
    load_environment_variables();
    const server_config = get_server_config();

    const task_repository = new TaskRepository({
      connection_uri: server_config.mongodb_uri,
      database_name: server_config.mongodb_database_name
    });
    await task_repository.connect();

    const reminder_scheduler = new ReminderScheduler({
      enable_immediate_dispatch: server_config.node_environment !== 'production'
    });

    const express_app = express();
    register_health_route(express_app);

    const line_webhook_router = build_line_webhook_router({
      channel_secret: server_config.line_channel_secret,
      task_repository,
      reminder_scheduler,
      reminder_offset_minutes: server_config.default_reminder_offset_minutes
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

    /**
     * Gracefully shut down the HTTP server and disconnect dependencies on termination signals.
     * @returns {Promise<void>} Resolves when cleanup completes.
     */
    const shutdown = async (): Promise<void> => {
      const shutdown_function_name = 'shutdown_handler';
      log_function_entry(root_logger, shutdown_function_name);
      await task_repository.disconnect();
      await reminder_scheduler.shutdown();
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
