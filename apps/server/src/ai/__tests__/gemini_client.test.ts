import { Response } from 'undici';

import { GeminiClient } from '../gemini_client';

describe('GeminiClient', () => {
  const api_key = 'test-key';
  const model = 'gemini-test';

  test('generate_text returns parsed text on success', async () => {
    const http_client = jest.fn(async (_input: RequestInfo, _init?: RequestInit) => {
      const body = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Acknowledged.'
                }
              ]
            }
          }
        ]
      };

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const client = new GeminiClient({
      api_key,
      model,
      http_client
    });

    const result = await client.generate_text('Hello');

    expect(result).toBe('Acknowledged.');
    expect(http_client).toHaveBeenCalled();
  });

  test('generate_text throws when API response lacks text', async () => {
    const http_client = jest.fn(async (_input: RequestInfo, _init?: RequestInit) => new Response(JSON.stringify({}), { status: 200 }));

    const client = new GeminiClient({
      api_key,
      model,
      http_client
    });

    await expect(client.generate_text('Hello')).rejects.toThrow('Gemini API response missing generated text');
  });
});
