import { createHmac, timingSafeEqual } from 'crypto';

import { log_function_entry, log_function_error, log_function_success, root_logger } from '../logger';

export interface SignatureValidationInput {
  readonly channel_secret: string;
  readonly request_body: string;
  readonly signature_to_compare: string;
  readonly context_id?: string;
}

/**
 * Validate incoming LINE webhook signatures using the shared channel secret.
 * @param {SignatureValidationInput} input Input payload containing channel secret, request body, and signature to validate.
 * @returns {boolean} Boolean flag indicating whether the signature matches.
 */
export function validate_line_signature(input: SignatureValidationInput): boolean {
  const function_name = 'validate_line_signature';
  log_function_entry(root_logger, function_name, { context_id: input.context_id });

  const hmac = createHmac('sha256', input.channel_secret);
  hmac.update(input.request_body);
  const expected_signature = hmac.digest('base64');

  try {
    if (expected_signature.length !== input.signature_to_compare.length) {
      log_function_success(root_logger, function_name, {
        context_id: input.context_id,
        is_valid: false
      });
      return false;
    }

    const is_valid = timingSafeEqual(
      Buffer.from(expected_signature),
      Buffer.from(input.signature_to_compare)
    );

    log_function_success(root_logger, function_name, {
      context_id: input.context_id,
      is_valid
    });

    return is_valid;
  } catch (error) {
    log_function_error(root_logger, function_name, error, { context_id: input.context_id });
    return false;
  }
}
