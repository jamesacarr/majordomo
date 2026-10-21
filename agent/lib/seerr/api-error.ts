/** A non-2xx answer from Seerr, carrying the HTTP status and Seerr's own message. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;
  /** Seerr's message as it sent it, without the `Seerr answered HTTP …:` prefix. */
  readonly seerrMessage: string;

  constructor(status: number, message: string) {
    super(`Seerr answered HTTP ${status}: ${message}`);
    this.status = status;
    this.seerrMessage = message;
  }
}
