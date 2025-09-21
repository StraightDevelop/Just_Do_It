import type { ConnectionOptions, JobsOptions } from 'bullmq';
import { Queue, Worker } from 'bullmq';

import type { ReminderRequest } from '@mr-leo/shared';
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
  readonly enable_offline_fallback?: boolean;
  readonly force_in_memory_mode?: boolean;
}

/**
 * ReminderScheduler integrates with BullMQ to enqueue delayed reminder jobs processed by a worker.
 */
export class ReminderScheduler {
  private readonly queue_name: string;

  private readonly reminder_dispatcher: ReminderDispatcher;

  private queue: Queue<ReminderJobData> | undefined;

  private worker: Worker<ReminderJobData> | undefined;

  private initialized = false;

  private readonly enable_offline_fallback: boolean;

  private scheduler_mode: 'bullmq' | 'in_memory';

  private readonly active_timers = new Map<string, NodeJS.Timeout>();

  constructor(dependencies: ReminderSchedulerDependencies) {
    const function_name = 'ReminderScheduler.constructor';
    log_function_entry(reminder_scheduler_logger, function_name, {
      queue_name: dependencies.queue_name ?? 'task_reminders'
    });

    this.queue_name = dependencies.queue_name ?? 'task_reminders';
    this.reminder_dispatcher = dependencies.reminder_dispatcher;
    this.enable_offline_fallback = dependencies.enable_offline_fallback ?? false;
    this.scheduler_mode = dependencies.force_in_memory_mode ? 'in_memory' : 'bullmq';

    if (this.scheduler_mode === 'bullmq') {
      try {
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
      } catch (error) {
        if (this.enable_offline_fallback) {
          reminder_scheduler_logger.warn(
            {
              event: 'bullmq_constructor_failed',
              queue_name: this.queue_name,
              error
            },
            'BullMQ constructor failed; defaulting to in-memory reminder scheduler'
          );
          this.queue = undefined;
          this.worker = undefined;
          this.scheduler_mode = 'in_memory';
        } else {
          throw error;
        }
      }
    }

    log_function_success(reminder_scheduler_logger, function_name, {
      queue_name: this.queue_name,
      scheduler_mode: this.scheduler_mode
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
        already_initialized: true,
        scheduler_mode: this.scheduler_mode
      });
      return;
    }

    if (this.scheduler_mode === 'in_memory') {
      this.initialized = true;
      log_function_success(reminder_scheduler_logger, function_name, {
        queue_name: this.queue_name,
        already_initialized: false,
        scheduler_mode: this.scheduler_mode
      });
      return;
    }

    try {
      const readiness_promises: Array<Promise<unknown>> = [];
      if (this.queue) {
        readiness_promises.push(this.queue.waitUntilReady());
      }
      if (this.worker) {
        readiness_promises.push(this.worker.waitUntilReady());
      }

      await Promise.all(readiness_promises);

      this.initialized = true;
      log_function_success(reminder_scheduler_logger, function_name, {
        queue_name: this.queue_name,
        already_initialized: false,
        scheduler_mode: this.scheduler_mode
      });
    } catch (error) {
      if (this.enable_offline_fallback) {
        reminder_scheduler_logger.warn(
          {
            event: 'bullmq_initialization_failed',
            queue_name: this.queue_name,
            error
          },
          'BullMQ initialization failed; falling back to in-memory reminder scheduler'
        );
        await this.switch_to_in_memory_mode('bullmq_initialization_failed');

        this.initialized = true;
        log_function_success(reminder_scheduler_logger, function_name, {
          queue_name: this.queue_name,
          already_initialized: false,
          scheduler_mode: this.scheduler_mode
        });
        return;
      }

      log_function_error(reminder_scheduler_logger, function_name, error, {
        queue_name: this.queue_name
      });
      throw error;
    }
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

      if (this.scheduler_mode === 'in_memory') {
        const timer_handle = setTimeout(() => {
          void this.process_job(reminder_request).catch((error) => {
            log_function_error(reminder_scheduler_logger, `${function_name}_timer_callback`, error, {
              task_id: reminder_request.task.task_id
            });
          });
        }, delay_ms);

        this.active_timers.set(reminder_request.task.task_id, timer_handle);
      } else if (this.queue) {
        await this.queue.add(
          'dispatch_task_reminder',
          { reminder_request },
          job_options
        );
      } else {
        const error = new Error('ReminderScheduler queue not initialized');
        log_function_error(reminder_scheduler_logger, function_name, error, {
          task_id: reminder_request.task.task_id
        });
        throw error;
      }

      log_function_success(reminder_scheduler_logger, function_name, {
        task_id: reminder_request.task.task_id,
        delay_ms,
        scheduler_mode: this.scheduler_mode
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
      if (this.scheduler_mode === 'in_memory') {
        const timer_handle = this.active_timers.get(task_id);
        if (!timer_handle) {
          log_function_success(reminder_scheduler_logger, function_name, {
            task_id,
            cancelled: false,
            scheduler_mode: this.scheduler_mode
          });
          return false;
        }

        clearTimeout(timer_handle);
        this.active_timers.delete(task_id);

        log_function_success(reminder_scheduler_logger, function_name, {
          task_id,
          cancelled: true,
          scheduler_mode: this.scheduler_mode
        });
        return true;
      }

      if (!this.queue) {
        const error = new Error('ReminderScheduler queue not initialized');
        log_function_error(reminder_scheduler_logger, function_name, error, { task_id });
        throw error;
      }

      const job = await this.queue.getJob(task_id);
      if (!job) {
        log_function_success(reminder_scheduler_logger, function_name, {
          task_id,
          cancelled: false,
          scheduler_mode: this.scheduler_mode
        });
        return false;
      }

      await job.remove();

      log_function_success(reminder_scheduler_logger, function_name, {
        task_id,
        cancelled: true,
        scheduler_mode: this.scheduler_mode
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
      if (this.scheduler_mode === 'in_memory') {
        this.active_timers.forEach((timer_handle) => {
          clearTimeout(timer_handle);
        });
        this.active_timers.clear();
        this.initialized = false;

        log_function_success(reminder_scheduler_logger, function_name, {
          queue_name: this.queue_name,
          scheduler_mode: this.scheduler_mode
        });
        return;
      }

      const shutdown_promises: Array<Promise<unknown>> = [];
      if (this.worker) {
        shutdown_promises.push(this.worker.close());
      }
      if (this.queue) {
        shutdown_promises.push(this.queue.close());
      }

      await Promise.all(shutdown_promises);
      this.initialized = false;

      log_function_success(reminder_scheduler_logger, function_name, {
        queue_name: this.queue_name,
        scheduler_mode: this.scheduler_mode
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

  /**
   * Switch the scheduler into an in-memory timer-backed implementation.
   * @param {string} reason Description of the fallback trigger.
   * @returns {Promise<void>} Resolves after the in-memory mode is active.
   */
  private async switch_to_in_memory_mode(reason: string): Promise<void> {
    const function_name = 'ReminderScheduler.switch_to_in_memory_mode';
    log_function_entry(reminder_scheduler_logger, function_name, {
      queue_name: this.queue_name,
      reason
    });

    if (this.worker) {
      try {
        await this.worker.close();
      } catch (error) {
        reminder_scheduler_logger.warn(
          {
            event: 'bullmq_worker_close_failed',
            queue_name: this.queue_name,
            error
          },
          'Failed to close BullMQ worker during fallback'
        );
      }
    }

    if (this.queue) {
      try {
        await this.queue.close();
      } catch (error) {
        reminder_scheduler_logger.warn(
          {
            event: 'bullmq_queue_close_failed',
            queue_name: this.queue_name,
            error
          },
          'Failed to close BullMQ queue during fallback'
        );
      }
    }

    this.worker = undefined;
    this.queue = undefined;
    this.scheduler_mode = 'in_memory';
    this.active_timers.clear();

    log_function_success(reminder_scheduler_logger, function_name, {
      queue_name: this.queue_name,
      scheduler_mode: this.scheduler_mode
    });
  }
}
