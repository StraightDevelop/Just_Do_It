import { Collection, MongoClient } from 'mongodb';
import type { Logger } from 'pino';

import { task_payload_schema, type TaskPayload } from '@mr-leo/shared';
import {
  log_function_entry,
  log_function_error,
  log_function_success,
  root_logger
} from '../logger';

const memory_uri_scheme = 'memory://';

export interface TaskRepositoryDependencies {
  readonly connection_uri: string;
  readonly database_name: string;
  readonly collection_name?: string;
  readonly context_id?: string;
  readonly enable_offline_fallback?: boolean;
}

export class TaskRepository {
  private client: MongoClient | undefined;

  private collection: Collection<TaskPayload> | undefined;

  private readonly collection_name: string;

  private readonly database_name: string;

  private readonly logger: Logger;

  private readonly enable_offline_fallback: boolean;

  private repository_mode: 'mongo' | 'memory';

  private readonly in_memory_store = new Map<string, TaskPayload>();

  private is_connected = false;

  constructor(dependencies: TaskRepositoryDependencies) {
    const function_name = 'TaskRepository.constructor';
    root_logger.info(
      {
        event: 'function_entry',
        function_name,
        context_id: dependencies.context_id
      },
      'Constructing TaskRepository'
    );

    const mongo_mode_requested = !dependencies.connection_uri.startsWith(memory_uri_scheme);
    this.repository_mode = mongo_mode_requested ? 'mongo' : 'memory';
    this.client = mongo_mode_requested ? new MongoClient(dependencies.connection_uri) : undefined;
    this.database_name = dependencies.database_name;
    this.collection_name = dependencies.collection_name ?? 'tasks';
    this.logger = root_logger.child({ component: 'task_repository' });
    this.enable_offline_fallback = dependencies.enable_offline_fallback ?? false;

    root_logger.info(
      {
        event: 'function_exit',
        function_name,
        context_id: dependencies.context_id
      },
      'Constructed TaskRepository'
    );
  }

  /**
   * Establish a connection to MongoDB and cache the tasks collection reference.
   * @returns {Promise<void>} Resolves when the connection has been established.
   */
  async connect(): Promise<void> {
    const function_name = 'TaskRepository.connect';
    log_function_entry(this.logger, function_name);

    if (this.is_connected) {
      log_function_success(this.logger, function_name, { already_connected: true });
      return;
    }

    if (this.repository_mode === 'memory') {
      this.is_connected = true;
      log_function_success(this.logger, function_name, {
        already_connected: false,
        repository_mode: this.repository_mode
      });
      return;
    }

    try {
      await this.client?.connect();
      const database = this.client?.db(this.database_name);
      this.collection = database?.collection<TaskPayload>(this.collection_name);
      this.is_connected = true;

      log_function_success(this.logger, function_name, {
        already_connected: false,
        repository_mode: this.repository_mode
      });
    } catch (error) {
      if (this.enable_offline_fallback) {
        this.logger.warn(
          {
            event: 'mongo_connection_failed',
            repository_mode: this.repository_mode,
            fallback_repository_mode: 'memory',
            error
          },
          'Mongo connection failed; falling back to in-memory task store'
        );
        this.switch_to_memory_mode('mongo_connection_failed');
        log_function_success(this.logger, function_name, {
          already_connected: false,
          repository_mode: this.repository_mode
        });
        return;
      }

      log_function_error(this.logger, function_name, error);
      throw error;
    }
  }

  /**
   * Close the MongoDB client connection when it has been opened.
   * @returns {Promise<void>} Resolves when the client has been closed or was already closed.
   */
  async disconnect(): Promise<void> {
    const function_name = 'TaskRepository.disconnect';
    log_function_entry(this.logger, function_name);

    if (!this.is_connected) {
      log_function_success(this.logger, function_name, { already_disconnected: true });
      return;
    }

    if (this.repository_mode === 'memory') {
      this.is_connected = false;
      this.in_memory_store.clear();
      log_function_success(this.logger, function_name, {
        already_disconnected: false,
        repository_mode: this.repository_mode
      });
      return;
    }

    await this.client?.close();
    this.collection = undefined;
    this.is_connected = false;

    log_function_success(this.logger, function_name, {
      already_disconnected: false,
      repository_mode: this.repository_mode
    });
  }

  /**
   * Persist or update a task document in the tasks collection.
   * @param {TaskPayload} task_payload Validated task payload to persist.
   * @returns {Promise<void>} Resolves when the task has been upserted.
   */
  async save_task(task_payload: TaskPayload): Promise<void> {
    const function_name = 'TaskRepository.save_task';
    log_function_entry(this.logger, function_name, { task_id: task_payload.task_id });

    const validated_payload = task_payload_schema.parse(task_payload);

    if (this.repository_mode === 'memory') {
      this.in_memory_store.set(validated_payload.task_id, validated_payload);

      log_function_success(this.logger, function_name, {
        task_id: task_payload.task_id,
        repository_mode: this.repository_mode
      });
      return;
    }

    if (!this.collection) {
      const error = new Error('Repository not connected. Call connect() before save_task().');
      log_function_error(this.logger, function_name, error, { task_id: task_payload.task_id });
      throw error;
    }

    await this.collection.updateOne(
      { task_id: validated_payload.task_id },
      { $set: validated_payload },
      { upsert: true }
    );
    log_function_success(this.logger, function_name, {
      task_id: task_payload.task_id,
      repository_mode: this.repository_mode
    });
  }

  /**
   * Fetch every task for a specific user.
   * @param {string} user_id Target user identifier.
   * @returns {Promise<TaskPayload[]>} Matching task payloads.
   */
  async find_tasks_by_user(user_id: string): Promise<TaskPayload[]> {
    const function_name = 'TaskRepository.find_tasks_by_user';
    log_function_entry(this.logger, function_name, { user_id });

    if (this.repository_mode === 'memory') {
      const tasks = Array.from(this.in_memory_store.values())
        .filter((task) => task.user_id === user_id)
        .sort((left, right) => (left.due_at_iso ?? '').localeCompare(right.due_at_iso ?? ''));

      log_function_success(this.logger, function_name, {
        user_id,
        task_count: tasks.length,
        repository_mode: this.repository_mode
      });
      return tasks;
    }

    if (!this.collection) {
      const error = new Error('Repository not connected. Call connect() before find_tasks_by_user().');
      log_function_error(this.logger, function_name, error, { user_id });
      throw error;
    }

    const tasks = await this.collection
      .find({ user_id })
      .sort({ due_at_iso: 1 })
      .toArray();

    log_function_success(this.logger, function_name, {
      user_id,
      task_count: tasks.length,
      repository_mode: this.repository_mode
    });
    return tasks;
  }

  /**
   * Switch the repository into in-memory mode after a MongoDB failure.
   * @param {string} reason Textual reason describing the fallback trigger.
   * @returns {void}
   */
  private switch_to_memory_mode(reason: string): void {
    const function_name = 'TaskRepository.switch_to_memory_mode';
    log_function_entry(this.logger, function_name, { reason });

    this.client = undefined;
    this.collection = undefined;
    this.repository_mode = 'memory';
    this.is_connected = true;
    this.in_memory_store.clear();

    log_function_success(this.logger, function_name, { repository_mode: this.repository_mode });
  }
}
