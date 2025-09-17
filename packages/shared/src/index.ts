import { z } from 'zod';

export const task_status_enum = z.enum(['pending', 'completed', 'snoozed']);
export type TaskStatus = z.infer<typeof task_status_enum>;

export const reminder_channel_enum = z.enum(['line']);
export type ReminderChannel = z.infer<typeof reminder_channel_enum>;

export const task_payload_schema = z.object({
  task_id: z.string().uuid(),
  user_id: z.string().min(1),
  title: z.string().min(1),
  due_at_iso: z.string().datetime().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  category: z.string().optional(),
  status: task_status_enum.default('pending'),
  reminder_channel: reminder_channel_enum.default('line'),
  created_at_iso: z.string().datetime(),
  updated_at_iso: z.string().datetime()
});
export type TaskPayload = z.infer<typeof task_payload_schema>;

export const reminder_request_schema = z.object({
  task: task_payload_schema,
  reminder_time_iso: z.string().datetime()
});
export type ReminderRequest = z.infer<typeof reminder_request_schema>;
