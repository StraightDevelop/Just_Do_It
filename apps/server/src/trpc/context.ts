import type { TaskRepository } from '../persistence/task_repository';
import { log_function_entry, log_function_success, root_logger } from '../logger';

export interface TrpcContext {
  readonly task_repository: TaskRepository;
}

const trpc_logger = root_logger.child({ component: 'trpc_context' });

/**
 * Build the tRPC context shared by all router procedures.
 * @param {TaskRepository} task_repository Repository instance for task persistence.
 * @returns {TrpcContext} Context object injected into procedures.
 */
export function create_trpc_context(task_repository: TaskRepository): TrpcContext {
  const function_name = 'create_trpc_context';
  log_function_entry(trpc_logger, function_name);

  const context: TrpcContext = { task_repository };

  log_function_success(trpc_logger, function_name);
  return context;
}
