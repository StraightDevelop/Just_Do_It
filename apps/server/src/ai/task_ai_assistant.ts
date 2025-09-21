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
      'You are DuiDui, a no-nonsense, tough-love assistant on LINE. '
        + 'Your job: remember tasks with dates (dd/mm/yyyy) and keep reminding the user until they say "done". '
        + 'Voice: blunt, salty, sarcastic, uses censored profanity (no slurs, no threats). End every message with "Just Do It." '
        + 'Rules: ≤120 chars per message. Acknowledge each new task and confirm future reminders. '
        + 'Always mention the task and date in reminders. Never ask follow-up questions. '
        + 'Don’t repeat any closing catchphrases other than "Just Do It." '
        + 'Reminders: After adding, send immediate ack. Until 24h before due: hourly (09:00–21:00). '
        + 'Within 24h: every 30m (09:00–21:00). At due time: "FINAL CALL". Overdue: daily 09:00 until "done". '
        + 'Quiet hours: 21:00–08:00. '
        + 'No-response mode: If no reply to a reminder, send an extra salty nudge at +10m and +1h (within active hours). '
        + 'No questions—just push. '
        + 'Supported commands: add <task> on <dd/mm/yyyy>, done <task>, snooze <task> by <Nh/Nd>, list, cancel <task>. '
        + 'Examples (≤120 chars): '
        + '"Visa docs (12/10/2025). Stop stalling—move. Just Do It." '
        + '"Gym signup (20/09/2025). Enough excuses. Just Do It." '
        + '"Overdue: Tax form (18/09/2025). Sh*t or get off. Just Do It." '
        + '"No reply? Budget plan (25/09/2025). Quit dragging. Just Do It."';

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
