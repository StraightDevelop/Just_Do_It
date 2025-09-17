import { createHmac } from 'crypto';

import { validate_line_signature } from '../line_signature_validator';

describe('validate_line_signature', () => {
  const channel_secret = 'test-channel-secret';
  const request_body = JSON.stringify({ foo: 'bar' });

  const signature = createHmac('sha256', channel_secret)
    .update(request_body)
    .digest('base64');

  test('returns true when the signature matches', () => {
    expect(
      validate_line_signature({
        channel_secret,
        request_body,
        signature_to_compare: signature
      })
    ).toBe(true);
  });

  test('returns false when the signature mismatches', () => {
    expect(
      validate_line_signature({
        channel_secret,
        request_body,
        signature_to_compare: 'invalid-signature'
      })
    ).toBe(false);
  });
});
