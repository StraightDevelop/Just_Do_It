import { Response } from 'undici';
import type { RequestInit } from 'undici';

import type { TaskPayload } from '@mr-leo/shared';
import { ReminderDispatcher } from '../reminder_dispatcher';

const base_task_payload: TaskPayload = {
  task_id: '8f668c1f-9d0d-4cb2-b2a6-c6b70fbf80b7',
  user_id: 'user-123',
  title: 'Review pull request',
  due_at_iso: '2025-10-01T12:00:00.000Z',
  priority: 'normal',
  category: undefined,
  status: 'pending',
  reminder_channel: 'line',
  created_at_iso: '2025-09-17T00:00:00.000Z',
  updated_at_iso: '2025-09-17T00:00:00.000Z'
};

const closing_phrase = 'Are you statisfied, habibi?';

describe('ReminderDispatcher', () => {
  test('build_message_text appends closing phrase and due date suffix', () => {
    const reminder_dispatcher = new ReminderDispatcher({
      api_base_url: 'https://api.line.me',
      channel_access_token: 'token',
      closing_phrase
    });

    const message_text = reminder_dispatcher.build_message_text(base_task_payload);

    expect(message_text).toContain(closing_phrase);
    expect(message_text).toContain('Review pull request');
    expect(message_text).toContain('due');
  });

  test('dispatch_task_reminder sends push payload via provided HTTP client', async () => {
    let captured_request: { readonly input: string; readonly init: RequestInit | undefined } | undefined;

    const http_client = async (input: string, init?: RequestInit): Promise<Response> => {
      captured_request = { input, init };
      return new Response(null, { status: 200 });
    };

    const reminder_dispatcher = new ReminderDispatcher({
      api_base_url: 'https://api.line.me',
      channel_access_token: 'token',
      closing_phrase,
      http_client
    });

    await reminder_dispatcher.dispatch_task_reminder(base_task_payload);

    expect(captured_request).toBeDefined();
    expect(captured_request?.input).toBe('https://api.line.me/v2/bot/message/push');

    const request_body = captured_request?.init?.body ? JSON.parse(captured_request.init.body as string) : undefined;
    expect(request_body).toMatchObject({
      to: base_task_payload.user_id
    });
    expect(request_body?.messages?.[0]?.text).toContain(closing_phrase);
  });
});
