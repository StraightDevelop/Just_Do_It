import type { ConnectionOptions, JobsOptions } from 'bullmq';
import { Queue, Worker } from 'bullmq';

import type { ReminderRequest } from '../../../../packages/shared/src/index';
import { log_function_entry, log_function_error, log_function_success, root_logger } from '../logger';
import { ReminderDispatcher } from './reminder_dispatcher';

const reminder_scheduler_logger = root_logger.child({ component: 'bullmq_reminder_scheduler' });

interface ReminderJobData {
  readonly reminder_request: ReminderRequest;
}

export interface ReminderSchedulerDependencies {
  readonly connection: ConnectionOptions;
  readonly reminder_dispatcher: ReminderDispatcher;
  readonly queue_name?: string;
}

/**
 * ReminderScheduler integrates with BullMQ to enqueue delayed reminder jobs processed by a worker.
 */
export class ReminderScheduler {
  private readonly queue_name: string;

  private readonly reminder_dispatcher: ReminderDispatcher;

  private readonly queue: Queue<ReminderJobData>;

  private readonly worker: Worker<ReminderJobData>;

  private initialized = false;

  constructor(dependencies: ReminderSchedulerDependencies) {
    const function_name = 'ReminderScheduler.constructor';
    log_function_entry(reminder_scheduler_logger, function_name, {
      queue_name: dependencies.queue_name ?? 'task_reminders'
    });

    this.queue_name = dependencies.queue_name ?? 'task_reminders';
    this.reminder_dispatcher = dependencies.reminder_dispatcher;
    this.queue = new Queue<ReminderJobData>(this.queue_name, {
      connection: dependencies.connection
    });
    this.worker = new Worker<ReminderJobData>(
      this.queue_name,
      async (job) => {
        await this.process_job(job.data.reminder_request);
      },
      {
        connection: dependencies.connection
      }
    );

    this.worker.on('failed', (job, error) => {
      reminder_scheduler_logger.error(
        {
          event: 'reminder_job_failed',
          job_id: job?.id,
          task_id: job?.data.reminder_request.task.task_id,
          error
        },
        'Reminder job failed'
      );
    });

    log_function_success(reminder_scheduler_logger, function_name, {
      queue_name: this.queue_name
    });
  }

  /**
   * Initialize the BullMQ queue scheduler and worker.
   * @returns {Promise<void>} Resolves when underlying BullMQ components are ready.
   */
  async initialize(): Promise<void> {
    const function_name = 'ReminderScheduler.initialize';
    log_function_entry(reminder_scheduler_logger, function_name, {
      queue_name: this.queue_name
    });

    if (this.initialized) {
      log_function_success(reminder_scheduler_logger, function_name, {
        queue_name: this.queue_name,
        already_initialized: true
      });
      return;
    }

    await Promise.all([this.queue.waitUntilReady(), this.worker.waitUntilReady()]);

    this.initialized = true;
    log_function_success(reminder_scheduler_logger, function_name, {
      queue_name: this.queue_name,
      already_initialized: false
    });
  }

  /**
   * Schedule a reminder by creating a delayed BullMQ job keyed by task identifier.
   * @param {ReminderRequest} reminder_request Reminder payload containing task metadata and trigger time.
   * @returns {Promise<void>} Resolves when the reminder job has been enqueued.
   */
  async schedule_reminder(reminder_request: ReminderRequest): Promise<void> {
    const function_name = 'ReminderScheduler.schedule_reminder';
    log_function_entry(reminder_scheduler_logger, function_name, {
      task_id: reminder_request.task.task_id,
      reminder_time_iso: reminder_request.reminder_time_iso
    });

    try {
      await this.cancel_reminder(reminder_request.task.task_id);

      const delay_ms = this.calculate_delay_ms(reminder_request.reminder_time_iso);
      const job_options: JobsOptions = {
        jobId: reminder_request.task.task_id,
        delay: delay_ms,
        removeOnComplete: true,
        removeOnFail: true
      };

      await this.queue.add(
        'dispatch_task_reminder',
        { reminder_request },
        job_options
      );

      log_function_success(reminder_scheduler_logger, function_name, {
        task_id: reminder_request.task.task_id,
        delay_ms
      });
    } catch (error) {
      log_function_error(reminder_scheduler_logger, function_name, error, {
        task_id: reminder_request.task.task_id
      });
      throw error;
    }
  }

  /**
   * Cancel a scheduled reminder when present.
   * @param {string} task_id Identifier whose reminder should be removed.
   * @returns {Promise<boolean>} Boolean indicating whether a reminder was cancelled.
   */
  async cancel_reminder(task_id: string): Promise<boolean> {
    const function_name = 'ReminderScheduler.cancel_reminder';
    log_function_entry(reminder_scheduler_logger, function_name, { task_id });

    try {
      const job = await this.queue.getJob(task_id);
      if (!job) {
        log_function_success(reminder_scheduler_logger, function_name, {
          task_id,
          cancelled: false
        });
        return false;
      }

      await job.remove();

      log_function_success(reminder_scheduler_logger, function_name, {
        task_id,
        cancelled: true
      });
      return true;
    } catch (error) {
      log_function_error(reminder_scheduler_logger, function_name, error, { task_id });
      throw error;
    }
  }

  /**
   * Shutdown BullMQ components gracefully.
   * @returns {Promise<void>} Resolves when the queue, worker, and scheduler are closed.
   */
  async shutdown(): Promise<void> {
    const function_name = 'ReminderScheduler.shutdown';
    log_function_entry(reminder_scheduler_logger, function_name, {
      queue_name: this.queue_name
    });

    try {
      await Promise.all([this.worker.close(), this.queue.close()]);
      this.initialized = false;

      log_function_success(reminder_scheduler_logger, function_name, {
        queue_name: this.queue_name
      });
    } catch (error) {
      log_function_error(reminder_scheduler_logger, function_name, error, {
        queue_name: this.queue_name
      });
      throw error;
    }
  }

  private calculate_delay_ms(reminder_time_iso: string): number {
    const function_name = 'ReminderScheduler.calculate_delay_ms';
    log_function_entry(reminder_scheduler_logger, function_name, {
      reminder_time_iso
    });

    const trigger_time = new Date(reminder_time_iso).getTime();
    const now = Date.now();
    const delay_ms = Math.max(trigger_time - now, 0);

    log_function_success(reminder_scheduler_logger, function_name, {
      reminder_time_iso,
      delay_ms
    });
    return delay_ms;
  }

  private async process_job(reminder_request: ReminderRequest): Promise<void> {
    const function_name = 'ReminderScheduler.process_job';
    log_function_entry(reminder_scheduler_logger, function_name, {
      task_id: reminder_request.task.task_id
    });

    try {
      await this.reminder_dispatcher.dispatch_task_reminder(reminder_request.task);
      log_function_success(reminder_scheduler_logger, function_name, {
        task_id: reminder_request.task.task_id
      });
    } catch (error) {
      log_function_error(reminder_scheduler_logger, function_name, error, {
        task_id: reminder_request.task.task_id
      });
      throw error;
    }
  }
}
