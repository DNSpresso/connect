const ERROR_CODES = [
  "INVALID_DOMAIN",
  "INVALID_DNS_RECORD",
  "DNS_LOOKUP_FAILED",
  "OAUTH_PROVIDER_NOT_CONFIGURED",
  "OAUTH_INVALID_REQUEST",
  "OAUTH_TOKEN_EXCHANGE_FAILED",
  "OAUTH_TOKEN_RESPONSE_INVALID",
] as const;

type ConnectErrorCode = (typeof ERROR_CODES)[number];

class ConnectError extends Error {
  constructor(
    readonly code: ConnectErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ConnectError";
  }
}

export { ConnectError };
export type { ConnectErrorCode };
