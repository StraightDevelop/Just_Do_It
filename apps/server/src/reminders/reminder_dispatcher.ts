import { fetch } from 'undici';
import type { RequestInit, Response } from 'undici';

import type { TaskPayload } from '../../../../packages/shared/src/index';
import { log_function_entry, log_function_error, log_function_success, root_logger } from '../logger';

const reminder_dispatcher_logger = root_logger.child({ component: 'reminder_dispatcher' });

export interface HttpClient {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface ReminderDispatcherDependencies {
  readonly api_base_url: string;
  readonly channel_access_token: string;
  readonly closing_phrase: string;
  readonly http_client?: HttpClient;
}

interface PushMessagePayload {
  readonly to: string;
  readonly messages: Array<{ readonly type: 'text'; readonly text: string }>;
}

/**
 * ReminderDispatcher delivers LINE push messages ensuring persona phrasing is appended.
 */
export class ReminderDispatcher {
  private readonly api_base_url: string;

  private readonly channel_access_token: string;

  private readonly closing_phrase: string;

  private readonly http_client: HttpClient;

  constructor(dependencies: ReminderDispatcherDependencies) {
    const function_name = 'ReminderDispatcher.constructor';
    log_function_entry(reminder_dispatcher_logger, function_name, {
      api_base_url: dependencies.api_base_url
    });

    this.api_base_url = dependencies.api_base_url.replace(/\/$/, '');
    this.channel_access_token = dependencies.channel_access_token;
    this.closing_phrase = dependencies.closing_phrase;
    this.http_client = dependencies.http_client ?? fetch;

    log_function_success(reminder_dispatcher_logger, function_name, {
      api_base_url: this.api_base_url
    });
  }

  /**
   * Dispatch a reminder by performing an authenticated LINE push message call.
   * @param {TaskPayload} task_payload Task metadata used to populate the reminder message.
   * @returns {Promise<void>} Resolves once the message has been delivered or an error is thrown.
   */
  async dispatch_task_reminder(task_payload: TaskPayload): Promise<void> {
    const function_name = 'ReminderDispatcher.dispatch_task_reminder';
    log_function_entry(reminder_dispatcher_logger, function_name, {
      task_id: task_payload.task_id,
      user_id: task_payload.user_id
    });

    try {
      const push_payload = this.build_push_message_payload(task_payload);
      const response = await this.http_client(`${this.api_base_url}/v2/bot/message/push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.channel_access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(push_payload)
      });

      if (!response.ok) {
        const error = new Error(
          `LINE push request failed with status ${response.status}: ${response.statusText}`
        );
        log_function_error(reminder_dispatcher_logger, function_name, error, {
          task_id: task_payload.task_id,
          user_id: task_payload.user_id,
          status: response.status
        });
        throw error;
      }

      log_function_success(reminder_dispatcher_logger, function_name, {
        task_id: task_payload.task_id,
        user_id: task_payload.user_id
      });
    } catch (error) {
      log_function_error(reminder_dispatcher_logger, function_name, error, {
        task_id: task_payload.task_id,
        user_id: task_payload.user_id
      });
      throw error;
    }
  }

  /**
   * Build the LINE push payload applying persona-specific phrasing.
   * @param {TaskPayload} task_payload Task metadata used for message creation.
   * @returns {PushMessagePayload} Structured LINE push payload.
   */
  build_push_message_payload(task_payload: TaskPayload): PushMessagePayload {
    const function_name = 'ReminderDispatcher.build_push_message_payload';
    log_function_entry(reminder_dispatcher_logger, function_name, {
      task_id: task_payload.task_id
    });

    const message_text = this.build_message_text(task_payload);

    const payload: PushMessagePayload = {
      to: task_payload.user_id,
      messages: [
        {
          type: 'text',
          text: message_text
        }
      ]
    };

    log_function_success(reminder_dispatcher_logger, function_name, {
      task_id: task_payload.task_id
    });
    return payload;
  }

  /**
   * Compose the reminder message body combining title, due date, and persona closing phrase.
   * @param {TaskPayload} task_payload Task metadata for message construction.
   * @returns {string} Final message text to dispatch.
   */
  build_message_text(task_payload: TaskPayload): string {
    const function_name = 'ReminderDispatcher.build_message_text';
    log_function_entry(reminder_dispatcher_logger, function_name, {
      task_id: task_payload.task_id
    });

    const due_suffix = task_payload.due_at_iso
      ? ` (due ${new Date(task_payload.due_at_iso).toLocaleString()})`
      : '';
    const message_text = `Reminder: ${task_payload.title}${due_suffix}. ${this.closing_phrase}`;

    log_function_success(reminder_dispatcher_logger, function_name, {
      task_id: task_payload.task_id
    });
    return message_text;
  }
}
