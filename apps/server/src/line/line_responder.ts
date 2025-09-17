import { fetch } from 'undici';
import type { Response } from 'undici';

import { log_function_entry, log_function_error, log_function_success, root_logger } from '../logger';

const line_responder_logger = root_logger.child({ component: 'line_responder' });

type HttpClient = (input: string, init?: Record<string, unknown>) => Promise<Response>;

export interface LineResponderDependencies {
  readonly channel_access_token: string;
  readonly api_base_url: string;
  readonly http_client?: HttpClient;
}

interface ReplyMessagePayload {
  readonly replyToken: string;
  readonly messages: Array<{ readonly type: 'text'; readonly text: string }>;
}

/**
 * LineResponder sends reply messages back to LINE using the replyToken contract.
 */
export class LineResponder {
  private readonly api_base_url: string;

  private readonly channel_access_token: string;

  private readonly http_client: HttpClient;

  constructor(dependencies: LineResponderDependencies) {
    const function_name = 'LineResponder.constructor';
    log_function_entry(line_responder_logger, function_name);

    this.api_base_url = dependencies.api_base_url.replace(/\/$/, '');
    this.channel_access_token = dependencies.channel_access_token;
    const default_http_client: HttpClient = async (input, init) => fetch(input, init as never);
    this.http_client = dependencies.http_client ?? default_http_client;

    log_function_success(line_responder_logger, function_name);
  }

  /**
   * Issue a reply to LINE for a specific reply token.
   * @param {string} reply_token Reply token provided by LINE.
   * @param {string} text Text message to send.
   * @param {string | undefined} context_id Optional correlation identifier for logs.
   * @returns {Promise<void>} Resolves when the reply completes.
   */
  async reply_with_text(reply_token: string, text: string, context_id?: string): Promise<void> {
    const function_name = 'LineResponder.reply_with_text';
    log_function_entry(line_responder_logger, function_name, { context_id });

    const payload: ReplyMessagePayload = {
      replyToken: reply_token,
      messages: [
        {
          type: 'text',
          text
        }
      ]
    };

    try {
      const response = await this.http_client(`${this.api_base_url}/v2/bot/message/reply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.channel_access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = new Error(`LINE reply API failed with status ${response.status}: ${await response.text()}`);
        log_function_error(line_responder_logger, function_name, error, { context_id, status: response.status });
        throw error;
      }

      log_function_success(line_responder_logger, function_name, { context_id });
    } catch (error) {
      log_function_error(line_responder_logger, function_name, error, { context_id });
      throw error;
    }
  }
}
