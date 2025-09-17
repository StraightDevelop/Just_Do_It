import { randomUUID } from 'crypto';

import { NextFunction, Request, Response, Router } from 'express';

import {
  reminder_request_schema,
  task_payload_schema,
  type ReminderRequest,
  type TaskPayload
} from '../../../../packages/shared/src/index';
import { log_function_entry, log_function_error, log_function_success, root_logger } from '../logger';
import type { TaskRepository } from '../persistence/task_repository';
import { ReminderScheduler } from '../reminders/reminder_scheduler';
import { validate_line_signature } from './line_signature_validator';

export interface LineWebhookDependencies {
  readonly channel_secret: string;
  readonly task_repository: TaskRepository;
  readonly reminder_scheduler: ReminderScheduler;
  readonly reminder_offset_minutes: number;
}

const line_logger = root_logger.child({ component: 'line_webhook' });
const default_task_priority: TaskPayload['priority'] = 'normal';
const fallback_user_identifier = 'unknown_user';

/**
 * Build an Express router encapsulating the LINE webhook endpoint.
 * @param {LineWebhookDependencies} dependencies Dependencies required to process LINE webhook events.
 * @returns {Router} Express router handling webhook traffic.
 */
export function build_line_webhook_router(dependencies: LineWebhookDependencies): Router {
  const function_name = 'build_line_webhook_router';
  log_function_entry(line_logger, function_name);

  const router = Router();
  const request_handler = create_line_webhook_request_handler(dependencies);
  router.post('/', request_handler);

  log_function_success(line_logger, function_name);
  return router;
}

/**
 * Create the Express request handler for LINE webhook traffic with injected dependencies.
 * @param {LineWebhookDependencies} dependencies Runtime dependencies required for processing.
 * @returns {(request: Request, response: Response, next: NextFunction) => Promise<void>} Configured request handler.
 */
function create_line_webhook_request_handler(
  dependencies: LineWebhookDependencies
): (request: Request, response: Response, next: NextFunction) => Promise<void> {
  const function_name = 'create_line_webhook_request_handler';
  log_function_entry(line_logger, function_name);

  /**
   * Process an incoming webhook payload from LINE, validate signatures, and persist task intents.
   * @param {Request} request Express request instance.
   * @param {Response} response Express response instance.
   * @param {NextFunction} next Express next callback for error propagation.
   * @returns {Promise<void>} Resolves when the response has been sent or error propagated.
   */
  async function line_webhook_request_handler(
    request: Request,
    response: Response,
    next: NextFunction
  ): Promise<void> {
    const context_id = request.headers['x-request-id']?.toString() ?? randomUUID();
    const handler_function_name = 'line_webhook_request_handler';
    log_function_entry(line_logger, handler_function_name, { context_id });

    try {
      const signature_header = request.headers['x-line-signature'];
      if (typeof signature_header !== 'string') {
        const error_message = 'Missing x-line-signature header';
        log_function_error(line_logger, handler_function_name, error_message, { context_id });
        log_function_success(line_logger, handler_function_name, {
          context_id,
          handled: false,
          reason: 'missing_signature_header'
        });
        response.sendStatus(401);
        return;
      }

      const raw_body_buffer = request.body instanceof Buffer ? request.body : Buffer.from(JSON.stringify(request.body));
      const request_body = raw_body_buffer.toString('utf-8');

      const is_valid_signature = validate_line_signature({
        channel_secret: dependencies.channel_secret,
        request_body,
        signature_to_compare: signature_header,
        context_id
      });

      if (!is_valid_signature) {
        log_function_success(line_logger, handler_function_name, {
          context_id,
          handled: false,
          reason: 'invalid_signature'
        });
        response.sendStatus(401);
        return;
      }

      const parsed_payload = JSON.parse(request_body) as Record<string, unknown>;
      const events = Array.isArray(parsed_payload.events) ? parsed_payload.events : [];

      for (const event of events) {
        await process_line_event(event as Record<string, unknown>, dependencies, context_id);
      }

      response.status(200).json({ status: 'ok' });

      log_function_success(line_logger, handler_function_name, {
        context_id,
        handled: true,
        event_count: events.length
      });
    } catch (error) {
      log_function_error(line_logger, handler_function_name, error, { context_id });
      next(error);
    }
  }

  log_function_success(line_logger, function_name);
  return line_webhook_request_handler;
}

/**
 * Process a single LINE event, converting task-oriented messages into persisted tasks.
 * @param {Record<string, unknown>} event Raw LINE event payload.
 * @param {LineWebhookDependencies} dependencies Runtime dependencies used for persistence.
 * @param {string} context_id Correlation identifier for logging continuity.
 * @returns {Promise<void>} Resolves when processing completes.
 */
async function process_line_event(
  event: Record<string, unknown>,
  dependencies: LineWebhookDependencies,
  context_id: string
): Promise<void> {
  const function_name = 'process_line_event';
  log_function_entry(line_logger, function_name, { context_id });

  const text = extract_message_text(event);

  if (!text) {
    log_function_success(line_logger, function_name, {
      context_id,
      handled: false,
      reason: 'non_text_event'
    });
    return;
  }

  const task_payload = transform_text_to_task(text, event, context_id);

  await dependencies.task_repository.save_task(task_payload);

  const reminder_request = build_reminder_request(
    task_payload,
    dependencies.reminder_offset_minutes,
    context_id
  );
  await dependencies.reminder_scheduler.schedule_reminder(reminder_request);

  log_function_success(line_logger, function_name, {
    context_id,
    handled: true,
    task_id: task_payload.task_id,
    reminder_time_iso: reminder_request.reminder_time_iso
  });
}

/**
 * Extract text content from a LINE event structure when available.
 * @param {Record<string, unknown>} event Raw LINE event payload.
 * @returns {string | undefined} Message text when event is a text message.
 */
function extract_message_text(event: Record<string, unknown>): string | undefined {
  const function_name = 'extract_message_text';
  log_function_entry(line_logger, function_name);

  const message = event.message as Record<string, unknown> | undefined;
  const message_type = message?.type;

  if (message_type !== 'text') {
    log_function_success(line_logger, function_name, { handled: false });
    return undefined;
  }

  const text = typeof message?.text === 'string' ? message.text : undefined;

  log_function_success(line_logger, function_name, { handled: Boolean(text) });
  return text;
}

/**
 * Transform a free-form text message into a minimal task payload for persistence.
 * @param {string} text Raw message text.
 * @param {Record<string, unknown>} event Full LINE event payload for metadata extraction.
 * @param {string} context_id Correlation identifier for logging continuity.
 * @returns {TaskPayload} Normalized task payload validated against shared schema.
 */
function transform_text_to_task(
  text: string,
  event: Record<string, unknown>,
  context_id: string
): TaskPayload {
  const function_name = 'transform_text_to_task';
  log_function_entry(line_logger, function_name, { context_id });

  const now_iso = new Date().toISOString();
  const source_user = event.source as Record<string, unknown> | undefined;
  const source_user_identifier = typeof source_user?.userId === 'string' ? source_user.userId : fallback_user_identifier;

  const candidate_payload: TaskPayload = {
    task_id: randomUUID(),
    user_id: source_user_identifier,
    title: text,
    due_at_iso: undefined,
    priority: default_task_priority,
    category: undefined,
    status: 'pending',
    reminder_channel: 'line',
    created_at_iso: now_iso,
    updated_at_iso: now_iso
  };

  const validated_payload = task_payload_schema.parse(candidate_payload);

  log_function_success(line_logger, function_name, {
    context_id,
    task_id: validated_payload.task_id
  });

  return validated_payload;
}

/**
 * Construct and validate a reminder request based on task metadata and configuration defaults.
 * @param {TaskPayload} task_payload Task payload that requires reminder scheduling.
 * @param {number} reminder_offset_minutes Default reminder lead time when no due date is provided.
 * @param {string} context_id Correlation identifier for consistent logs.
 * @returns {ReminderRequest} Validated reminder request structure.
 */
function build_reminder_request(
  task_payload: TaskPayload,
  reminder_offset_minutes: number,
  context_id: string
): ReminderRequest {
  const function_name = 'build_reminder_request';
  log_function_entry(line_logger, function_name, {
    context_id,
    task_id: task_payload.task_id,
    reminder_offset_minutes
  });

  const now = Date.now();
  const fallback_reminder_time = new Date(now + reminder_offset_minutes * 60_000).toISOString();
  const reminder_time_iso = task_payload.due_at_iso ?? fallback_reminder_time;

  const candidate_request: ReminderRequest = {
    task: task_payload,
    reminder_time_iso
  };

  const validated_request = reminder_request_schema.parse(candidate_request);

  log_function_success(line_logger, function_name, {
    context_id,
    task_id: task_payload.task_id,
    reminder_time_iso: validated_request.reminder_time_iso
  });

  return validated_request;
}
