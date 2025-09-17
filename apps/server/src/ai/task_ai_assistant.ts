import { log_function_entry, log_function_error, log_function_success, root_logger } from '../logger';
import { GeminiClient } from './gemini_client';

const task_ai_logger = root_logger.child({ component: 'task_ai_assistant' });

export interface TaskAiAssistantDependencies {
  readonly gemini_client: GeminiClient;
  readonly system_prompt?: string;
}

export interface TaskAiAssistantInput {
  readonly original_message: string;
  readonly user_id: string;
  readonly context_id?: string;
}

/**
 * TaskAiAssistant wraps generative model calls to craft conversational replies.
 */
export class TaskAiAssistant {
  private readonly gemini_client: GeminiClient;

  private readonly system_prompt: string;

  constructor(dependencies: TaskAiAssistantDependencies) {
    const function_name = 'TaskAiAssistant.constructor';
    log_function_entry(task_ai_logger, function_name);

    this.gemini_client = dependencies.gemini_client;
    this.system_prompt =
      dependencies.system_prompt ??
      'You are Mr Leo Class, a helpful and upbeat personal assistant on LINE. '
        + 'Keep responses short (<= 120 characters), acknowledge the task, and confirm you will remind them later. '
        + 'Never ask follow-up questions. Mention the task succinctly. Do not repeat the closing phrase "Are you statisfied, habibi?" here.';

    log_function_success(task_ai_logger, function_name);
  }

  /**
   * Produce a short acknowledgement message for an inbound LINE request.
   * @param {TaskAiAssistantInput} input Structured user input with optional context identifier.
   * @returns {Promise<string>} AI-generated acknowledgement text.
   */
  async generate_acknowledgement(input: TaskAiAssistantInput): Promise<string> {
    const function_name = 'TaskAiAssistant.generate_acknowledgement';
    log_function_entry(task_ai_logger, function_name, { context_id: input.context_id });

    try {
      const prompt = `${this.system_prompt}\nUser (${input.user_id}) said: "${input.original_message}".`;
      const acknowledgement = await this.gemini_client.generate_text(prompt, input.context_id);
      log_function_success(task_ai_logger, function_name, { context_id: input.context_id });
      return acknowledgement.trim();
    } catch (error) {
      log_function_error(task_ai_logger, function_name, error, { context_id: input.context_id });
      throw error;
    }
  }
}
