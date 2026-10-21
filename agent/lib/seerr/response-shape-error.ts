import type { z } from 'zod';

/** A 2xx answer from Seerr that did not match its schema, carrying the zod issues so callers can tell which fields were wrong. */
export class ResponseShapeError extends Error {
  override readonly name = 'ResponseShapeError';
  readonly issues: readonly z.core.$ZodIssue[];

  constructor(message: string, cause: z.ZodError) {
    super(message, { cause });
    this.issues = cause.issues;
  }
}
