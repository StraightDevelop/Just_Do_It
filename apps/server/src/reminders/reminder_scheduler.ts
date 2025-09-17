import { setTimeout as schedule_timeout } from 'timers/promises';
import { setTimeout as set_node_timeout, clearTimeout as clear_node_timeout } from 'timers';

import type { ReminderRequest, TaskPayload } from '../../../../packages/shared/src/index';
import { log_function_entry, log_function_error, log_function_success, root_logger } from '../logger';

const reminder_logger = root_logger.child({ component: 'reminder_scheduler' });

export interface ReminderSchedulerDependencies {
  readonly enable_immediate_dispatch?: boolean;
}

/**
 * Minimal reminder scheduler placeholder that records scheduled reminders and optionally simulates dispatch events.
 */
export class ReminderScheduler {
  private readonly scheduled_tasks: Map<string, NodeJS.Timeout> = new Map();

  private readonly enable_immediate_dispatch: boolean;

  constructor(dependencies: ReminderSchedulerDependencies = {}) {
    const function_name = 'ReminderScheduler.constructor';
    reminder_logger.info(
      {
        event: 'function_entry',
        function_name,
        enable_immediate_dispatch: dependencies.enable_immediate_dispatch ?? false
      },
      'Constructing ReminderScheduler'
    );

    this.enable_immediate_dispatch = dependencies.enable_immediate_dispatch ?? false;

    reminder_logger.info(
      {
        event: 'function_exit',
        function_name,
        enable_immediate_dispatch: this.enable_immediate_dispatch
      },
      'Constructed ReminderScheduler'
    );
  }

  /**
   * Schedule a reminder request and retain a cancellable handle.
   * @param {ReminderRequest} reminder_request Reminder payload representing the target task and trigger time.
   * @returns {Promise<void>} Resolves once the reminder has been recorded.
   */
  async schedule_reminder(reminder_request: ReminderRequest): Promise<void> {
    const function_name = 'ReminderScheduler.schedule_reminder';
    log_function_entry(reminder_logger, function_name, {
      task_id: reminder_request.task.task_id,
      reminder_time_iso: reminder_request.reminder_time_iso
    });

    await this.cancel_reminder(reminder_request.task.task_id);

    const now = new Date();
    const trigger_time = new Date(reminder_request.reminder_time_iso);
    const delay_ms = Math.max(trigger_time.getTime() - now.getTime(), 0);

    const timeout_handle = set_node_timeout(async () => {
      await this.dispatch_reminder(reminder_request.task);
    }, delay_ms);

    this.scheduled_tasks.set(reminder_request.task.task_id, timeout_handle);

    log_function_success(reminder_logger, function_name, {
      task_id: reminder_request.task.task_id,
      delay_ms
    });
  }

  /**
   * Cancel an existing reminder when it has been previously scheduled.
   * @param {string} task_id Identifier associated with the reminder to cancel.
   * @returns {Promise<boolean>} Boolean indicator describing whether a reminder was cancelled.
   */
  async cancel_reminder(task_id: string): Promise<boolean> {
    const function_name = 'ReminderScheduler.cancel_reminder';
    log_function_entry(reminder_logger, function_name, { task_id });

    const existing_timeout = this.scheduled_tasks.get(task_id);
    if (!existing_timeout) {
      log_function_success(reminder_logger, function_name, {
        task_id,
        cancelled: false
      });
      return false;
    }

    clear_node_timeout(existing_timeout);
    this.scheduled_tasks.delete(task_id);

    log_function_success(reminder_logger, function_name, { task_id, cancelled: true });
    return true;
  }

  /**
   * Simulate dispatching a reminder by logging activity.
   * @param {TaskPayload} task_payload Task payload to emit reminder for.
   * @returns {Promise<void>} Resolves after simulated send completes.
   */
  private async dispatch_reminder(task_payload: TaskPayload): Promise<void> {
    const function_name = 'ReminderScheduler.dispatch_reminder';
    log_function_entry(reminder_logger, function_name, { task_id: task_payload.task_id });

    try {
      if (this.enable_immediate_dispatch) {
        await schedule_timeout(0);
      }

      reminder_logger.info(
        {
          event: 'reminder_dispatch',
          task_id: task_payload.task_id,
          user_id: task_payload.user_id,
          reminder_channel: task_payload.reminder_channel
        },
        'Dispatching reminder placeholder'
      );

      log_function_success(reminder_logger, function_name, { task_id: task_payload.task_id });
    } catch (error) {
      log_function_error(reminder_logger, function_name, error, { task_id: task_payload.task_id });
      throw error;
    }
  }

  /**
   * Clear all scheduled reminders and release resources.
   * @returns {Promise<void>} Resolves when all timers are cleared.
   */
  async shutdown(): Promise<void> {
    const function_name = 'ReminderScheduler.shutdown';
    log_function_entry(reminder_logger, function_name, { scheduled_count: this.scheduled_tasks.size });

    for (const [task_id, timeout_handle] of this.scheduled_tasks.entries()) {
      clear_node_timeout(timeout_handle);
      reminder_logger.debug(
        {
          event: 'reminder_cancelled',
          task_id
        },
        'Cancelled scheduled reminder during shutdown'
      );
    }

    this.scheduled_tasks.clear();

    log_function_success(reminder_logger, function_name, { remaining: this.scheduled_tasks.size });
  }
}
