const ERROR_CODES = ["INVALID_DOMAIN", "INVALID_DNS_RECORD", "DNS_LOOKUP_FAILED"] as const;

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
