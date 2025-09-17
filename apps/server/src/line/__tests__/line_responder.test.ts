import { Response } from 'undici';

import { LineResponder } from '../line_responder';

describe('LineResponder', () => {
  const channel_access_token = 'token';
  const api_base_url = 'https://api.line.me';

  test('reply_with_text posts to LINE reply endpoint', async () => {
    const http_client = jest.fn(async (_input: RequestInfo, _init?: RequestInit) => new Response(undefined, { status: 200 }));

    const responder = new LineResponder({
      channel_access_token,
      api_base_url,
      http_client
    });

    await responder.reply_with_text('reply-token', 'Thanks!', 'ctx-1');

    expect(http_client).toHaveBeenCalledWith(
      `${api_base_url}/v2/bot/message/reply`,
      expect.objectContaining({
        method: 'POST'
      })
    );
  });

  test('reply_with_text throws when LINE responds with failure', async () => {
    const http_client = jest.fn(async (_input: RequestInfo, _init?: RequestInit) => new Response('bad request', { status: 400 }));

    const responder = new LineResponder({
      channel_access_token,
      api_base_url,
      http_client
    });

    await expect(responder.reply_with_text('reply-token', 'Thanks!')).rejects.toThrow('LINE reply API failed');
  });
});
