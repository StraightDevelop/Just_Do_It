import { initTRPC } from '@trpc/server';
import { z } from 'zod';

import type { TaskPayload } from '@mr-leo/shared';
import { log_function_entry, log_function_success, root_logger } from '../logger';
import type { TrpcContext } from './context';

const trpc_logger = root_logger.child({ component: 'trpc_router' });
const trpc = initTRPC.context<TrpcContext>().create();

export const app_router = build_app_router();
export type AppRouter = typeof app_router;

/**
 * Construct the root tRPC router with task-centric procedures.
 * @returns {ReturnType<typeof trpc.router>} Configured application router.
 */
function build_app_router() {
  const function_name = 'build_app_router';
  log_function_entry(trpc_logger, function_name);

  const router = trpc.router({
    get_user_tasks: trpc.procedure
      .input(z.object({ user_id: z.string().min(1) }))
      .query(async ({ input, ctx }) => {
        const resolver_function_name = 'get_user_tasks_resolver';
        log_function_entry(trpc_logger, resolver_function_name, { user_id: input.user_id });

        const tasks: TaskPayload[] = await ctx.task_repository.find_tasks_by_user(input.user_id);

        log_function_success(trpc_logger, resolver_function_name, {
          user_id: input.user_id,
          task_count: tasks.length
        });
        return tasks;
      })
  });

  log_function_success(trpc_logger, function_name);
  return router;
}
