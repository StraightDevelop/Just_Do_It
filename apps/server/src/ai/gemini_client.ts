import { fetch } from 'undici';
import type { Response } from 'undici';

import { log_function_entry, log_function_error, log_function_success, root_logger } from '../logger';

const gemini_logger = root_logger.child({ component: 'gemini_client' });

type HttpClient = (input: string, init?: Record<string, unknown>) => Promise<Response>;

export interface GeminiClientDependencies {
  readonly api_key: string;
  readonly model: string;
  readonly api_base_url?: string;
  readonly http_client?: HttpClient;
}

interface GenerateContentRequest {
  readonly contents: Array<{
    readonly role: string;
    readonly parts: Array<{ readonly text: string }>;
  }>;
}

interface GenerateContentResponse {
  readonly candidates?: Array<{
    readonly content?: {
      readonly parts?: Array<{ readonly text?: string }>;
    };
  }>;
  readonly promptFeedback?: unknown;
}

/**
 * GeminiClient performs minimal REST calls to the Gemini generative language API.
 */
export class GeminiClient {
  private readonly api_base_url: string;

  private readonly api_key: string;

  private readonly http_client: HttpClient;

  private readonly model: string;

  constructor(dependencies: GeminiClientDependencies) {
    const function_name = 'GeminiClient.constructor';
    log_function_entry(gemini_logger, function_name, { model: dependencies.model });

    this.api_key = dependencies.api_key;
    this.model = dependencies.model;
    this.api_base_url = dependencies.api_base_url ?? 'https://generativelanguage.googleapis.com/v1beta';
    const default_http_client: HttpClient = async (input, init) => fetch(input, init as never);
    this.http_client = dependencies.http_client ?? default_http_client;

    log_function_success(gemini_logger, function_name, {
      model: this.model,
      api_base_url: this.api_base_url
    });
  }

  /**
   * Generate a natural-language completion from the given prompt.
   * @param {string} prompt Prompt text provided by the caller.
   * @param {string | undefined} context_id Optional correlation identifier for logs.
   * @returns {Promise<string>} Generated text response.
   */
  async generate_text(prompt: string, context_id?: string): Promise<string> {
    const function_name = 'GeminiClient.generate_text';
    log_function_entry(gemini_logger, function_name, { context_id });

    const url = `${this.api_base_url}/models/${this.model}:generateContent?key=${this.api_key}`;
    const body: GenerateContentRequest = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };

    try {
      const response = await this.http_client(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const text = await this.extract_text_from_response(response);

      log_function_success(gemini_logger, function_name, { context_id });
      return text;
    } catch (error) {
      log_function_error(gemini_logger, function_name, error, { context_id });
      throw error;
    }
  }

  private async extract_text_from_response(response: Response): Promise<string> {
    const function_name = 'GeminiClient.extract_text_from_response';
    log_function_entry(gemini_logger, function_name, { status: response.status });

    if (!response.ok) {
      const error_text = await response.text();
      const error = new Error(`Gemini API request failed with status ${response.status}: ${error_text}`);
      log_function_error(gemini_logger, function_name, error, { status: response.status });
      throw error;
    }

    const payload = (await response.json()) as GenerateContentResponse;
    const candidate_text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidate_text) {
      const error = new Error('Gemini API response missing generated text');
      log_function_error(gemini_logger, function_name, error);
      throw error;
    }

    log_function_success(gemini_logger, function_name, { has_text: true });
    return candidate_text;
  }
}
