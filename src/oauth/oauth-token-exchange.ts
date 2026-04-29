import { ConnectError } from "../connect-error";

type OAuthTokenExchangeRequest = {
  readonly url: string;
  readonly body: URLSearchParams;
  readonly headers: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
};

type OAuthTokenExchangeResponse =
  | { readonly status: "success"; readonly payload: unknown }
  | { readonly status: "error"; readonly error: ConnectError };

type OAuthTokenExchangeTransport = (
  request: OAuthTokenExchangeRequest,
) => Promise<OAuthTokenExchangeResponse>;

type OAuthTokenExchangeTransportOptions = {
  readonly fetch?: typeof fetch;
};

function createOAuthTokenExchangeTransport(
  options?: OAuthTokenExchangeTransportOptions,
): OAuthTokenExchangeTransport {
  const fetchImpl = options?.fetch ?? globalThis.fetch;

  return async (request) => {
    if (fetchImpl === undefined) {
      return {
        status: "error",
        error: new ConnectError("OAUTH_TOKEN_EXCHANGE_FAILED", "No fetch implementation available"),
      };
    }

    try {
      const init: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          ...request.headers,
        },
        body: request.body,
      };

      if (request.signal !== undefined) {
        init.signal = request.signal;
      }

      const response = await fetchImpl(request.url, init);

      if (!response.ok) {
        return {
          status: "error",
          error: new ConnectError(
            "OAUTH_TOKEN_EXCHANGE_FAILED",
            `Token exchange failed with status ${response.status}`,
          ),
        };
      }

      const payload = (await response.json()) as unknown;
      return { status: "success", payload };
    } catch (error) {
      return {
        status: "error",
        error: new ConnectError("OAUTH_TOKEN_EXCHANGE_FAILED", "Token exchange failed", {
          cause: error,
        }),
      };
    }
  };
}

export { createOAuthTokenExchangeTransport };
export type {
  OAuthTokenExchangeRequest,
  OAuthTokenExchangeResponse,
  OAuthTokenExchangeTransport,
  OAuthTokenExchangeTransportOptions,
};
