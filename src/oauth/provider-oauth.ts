import { ConnectError } from "../connect-error";
import {
  PROVIDER_REGISTRY,
  type ProviderId,
  type ProviderOAuthConfig,
} from "../providers/provider-registry";
import {
  createOAuthTokenExchangeTransport,
  type OAuthTokenExchangeTransport,
} from "./oauth-token-exchange";

type ProviderOAuthPkceChallenge = {
  readonly codeChallenge: string;
  readonly codeChallengeMethod: "S256";
};

type ProviderOAuthPkceVerifier = {
  readonly codeVerifier: string;
};

type OAuthClientAuthentication =
  | { readonly method: "none" }
  | { readonly method: "body"; readonly clientSecret: string }
  | { readonly method: "basic"; readonly clientSecret: string };

type ProviderOAuthAuthorizationUrlOptions = {
  readonly providerId: ProviderId;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly scopes?: readonly string[];
  readonly pkce?: ProviderOAuthPkceChallenge;
  readonly extraParams?: Readonly<Record<string, string>>;
};

type ProviderOAuthAuthorizationUrlResult =
  | { readonly status: "success"; readonly url: string }
  | { readonly status: "provider-not-configured"; readonly error: ConnectError }
  | { readonly status: "invalid-request"; readonly error: ConnectError };

type ProviderOAuthTokenExchangeOptions = {
  readonly providerId: ProviderId;
  readonly code: string;
  readonly redirectUri: string;
  readonly clientId: string;
  readonly clientAuthentication?: OAuthClientAuthentication;
  readonly pkce?: ProviderOAuthPkceVerifier;
  readonly transport?: OAuthTokenExchangeTransport;
  readonly signal?: AbortSignal;
};

type ProviderOAuthTokens = {
  readonly accessToken: string;
  readonly tokenType: string;
  readonly expiresIn?: number;
  readonly refreshToken?: string;
  readonly scope?: string;
};

type ProviderOAuthTokenResult =
  | { readonly status: "success"; readonly tokens: ProviderOAuthTokens }
  | { readonly status: "provider-not-configured"; readonly error: ConnectError }
  | { readonly status: "invalid-request"; readonly error: ConnectError }
  | { readonly status: "exchange-failed"; readonly error: ConnectError }
  | { readonly status: "invalid-token-response"; readonly error: ConnectError };

function createProviderOAuthAuthorizationUrl(
  options: ProviderOAuthAuthorizationUrlOptions,
): ProviderOAuthAuthorizationUrlResult {
  const provider = PROVIDER_REGISTRY[options.providerId];
  if (provider?.oauth === undefined) {
    return {
      status: "provider-not-configured",
      error: new ConnectError(
        "OAUTH_PROVIDER_NOT_CONFIGURED",
        `Provider ${options.providerId} does not have OAuth configured`,
      ),
    };
  }

  return createProviderOAuthAuthorizationUrlForConfig({
    ...options,
    oauth: provider.oauth,
  });
}

function createProviderOAuthAuthorizationUrlForConfig(
  options: ProviderOAuthAuthorizationUrlOptions & { readonly oauth: ProviderOAuthConfig },
): ProviderOAuthAuthorizationUrlResult {
  const trimmedClientId = options.clientId.trim();
  if (trimmedClientId === "") {
    return {
      status: "invalid-request",
      error: new ConnectError("OAUTH_INVALID_REQUEST", "clientId is required"),
    };
  }

  const trimmedRedirectUri = options.redirectUri.trim();
  if (trimmedRedirectUri === "") {
    return {
      status: "invalid-request",
      error: new ConnectError("OAUTH_INVALID_REQUEST", "redirectUri is required"),
    };
  }

  try {
    const _url = new URL(trimmedRedirectUri);
    void _url;
  } catch {
    return {
      status: "invalid-request",
      error: new ConnectError("OAUTH_INVALID_REQUEST", "redirectUri is not a valid URL"),
    };
  }

  const trimmedState = options.state.trim();
  if (trimmedState === "") {
    return {
      status: "invalid-request",
      error: new ConnectError("OAUTH_INVALID_REQUEST", "state is required"),
    };
  }

  if (options.pkce !== undefined) {
    if (!options.oauth.supportsPkce) {
      return {
        status: "invalid-request",
        error: new ConnectError("OAUTH_INVALID_REQUEST", "Provider does not support PKCE"),
      };
    }

    if (options.pkce.codeChallenge.trim() === "") {
      return {
        status: "invalid-request",
        error: new ConnectError("OAUTH_INVALID_REQUEST", "codeChallenge is required"),
      };
    }
  }

  const selectedScopes = options.scopes ?? options.oauth.defaultScopes;
  if (selectedScopes.length > 0) {
    for (const scope of selectedScopes) {
      if (scope.trim() === "") {
        return {
          status: "invalid-request",
          error: new ConnectError("OAUTH_INVALID_REQUEST", "scope cannot be empty"),
        };
      }
    }
  }

  if (options.extraParams !== undefined) {
    for (const key of Object.keys(options.extraParams)) {
      if (key.trim() === "") {
        return {
          status: "invalid-request",
          error: new ConnectError("OAUTH_INVALID_REQUEST", "extraParams key cannot be empty"),
        };
      }
    }
  }

  const url = new URL(options.oauth.authorizationUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", trimmedClientId);
  url.searchParams.set("redirect_uri", trimmedRedirectUri);
  url.searchParams.set("state", trimmedState);

  if (selectedScopes.length > 0) {
    url.searchParams.set("scope", selectedScopes.join(" "));
  }

  if (options.pkce !== undefined) {
    url.searchParams.set("code_challenge", options.pkce.codeChallenge);
    url.searchParams.set("code_challenge_method", options.pkce.codeChallengeMethod);
  }

  if (options.extraParams !== undefined) {
    for (const [key, value] of Object.entries(options.extraParams)) {
      url.searchParams.set(key, value);
    }
  }

  return { status: "success", url: url.toString() };
}

function exchangeProviderOAuthCode(
  options: ProviderOAuthTokenExchangeOptions,
): Promise<ProviderOAuthTokenResult> {
  const provider = PROVIDER_REGISTRY[options.providerId];
  if (provider === undefined || provider.oauth === undefined) {
    return Promise.resolve({
      status: "provider-not-configured",
      error: new ConnectError(
        "OAUTH_PROVIDER_NOT_CONFIGURED",
        `Provider ${options.providerId} does not have OAuth configured`,
      ),
    });
  }

  return exchangeProviderOAuthCodeForConfig({
    ...options,
    oauth: provider.oauth,
  });
}

async function exchangeProviderOAuthCodeForConfig(
  options: ProviderOAuthTokenExchangeOptions & { readonly oauth: ProviderOAuthConfig },
): Promise<ProviderOAuthTokenResult> {
  const trimmedCode = options.code.trim();
  if (trimmedCode === "") {
    return {
      status: "invalid-request",
      error: new ConnectError("OAUTH_INVALID_REQUEST", "code is required"),
    };
  }

  const trimmedRedirectUri = options.redirectUri.trim();
  if (trimmedRedirectUri === "") {
    return {
      status: "invalid-request",
      error: new ConnectError("OAUTH_INVALID_REQUEST", "redirectUri is required"),
    };
  }

  try {
    void new URL(trimmedRedirectUri);
  } catch {
    return {
      status: "invalid-request",
      error: new ConnectError("OAUTH_INVALID_REQUEST", "redirectUri is not a valid URL"),
    };
  }

  const trimmedClientId = options.clientId.trim();
  if (trimmedClientId === "") {
    return {
      status: "invalid-request",
      error: new ConnectError("OAUTH_INVALID_REQUEST", "clientId is required"),
    };
  }

  if (options.pkce !== undefined) {
    if (!options.oauth.supportsPkce) {
      return {
        status: "invalid-request",
        error: new ConnectError("OAUTH_INVALID_REQUEST", "Provider does not support PKCE"),
      };
    }

    if (options.pkce.codeVerifier.trim() === "") {
      return {
        status: "invalid-request",
        error: new ConnectError("OAUTH_INVALID_REQUEST", "codeVerifier is required"),
      };
    }
  }

  const clientAuthentication = options.clientAuthentication ?? { method: "none" };

  if (clientAuthentication.method !== "none") {
    if (clientAuthentication.clientSecret.trim() === "") {
      return {
        status: "invalid-request",
        error: new ConnectError("OAUTH_INVALID_REQUEST", "clientSecret is required"),
      };
    }
  }

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", trimmedCode);
  body.set("redirect_uri", trimmedRedirectUri);
  body.set("client_id", trimmedClientId);

  const headers: Record<string, string> = {};

  if (clientAuthentication.method === "body") {
    body.set("client_secret", clientAuthentication.clientSecret);
  } else if (clientAuthentication.method === "basic") {
    const credentials = encodeOAuthBasicCredentials({
      clientId: trimmedClientId,
      clientSecret: clientAuthentication.clientSecret,
    });
    headers["Authorization"] = `Basic ${credentials}`;
  }

  if (options.pkce !== undefined) {
    body.set("code_verifier", options.pkce.codeVerifier);
  }

  const transport = options.transport ?? createOAuthTokenExchangeTransport();
  const request = {
    url: options.oauth.tokenUrl,
    body,
    headers,
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  };
  const transportResult = await transport(request);

  if (transportResult.status === "error") {
    return {
      status: "exchange-failed",
      error: transportResult.error,
    };
  }

  return parseTokenResponse(transportResult.payload);
}

function encodeOAuthBasicCredentials(options: {
  readonly clientId: string;
  readonly clientSecret: string;
}): string {
  const encodedCredentials = `${encodeOAuthCredentialPart(options.clientId)}:${encodeOAuthCredentialPart(
    options.clientSecret,
  )}`;
  return encodeBase64Utf8(encodedCredentials);
}

function encodeOAuthCredentialPart(value: string): string {
  return encodeURIComponent(value).replaceAll("%20", "+");
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const combined = (first << 16) | (second << 8) | third;

    output += alphabet.charAt((combined >> 18) & 63);
    output += alphabet.charAt((combined >> 12) & 63);
    output += index + 1 < bytes.length ? alphabet.charAt((combined >> 6) & 63) : "=";
    output += index + 2 < bytes.length ? alphabet.charAt(combined & 63) : "=";
  }

  return output;
}

function parseTokenResponse(payload: unknown): ProviderOAuthTokenResult {
  if (payload === null || typeof payload !== "object") {
    return {
      status: "invalid-token-response",
      error: new ConnectError(
        "OAUTH_TOKEN_RESPONSE_INVALID",
        "Token response payload must be an object",
      ),
    };
  }

  const obj = payload as Record<string, unknown>;

  const accessToken = obj["access_token"];
  if (typeof accessToken !== "string" || accessToken === "") {
    return {
      status: "invalid-token-response",
      error: new ConnectError(
        "OAUTH_TOKEN_RESPONSE_INVALID",
        "access_token must be a non-empty string",
      ),
    };
  }

  const tokenType = obj["token_type"];
  if (typeof tokenType !== "string" || tokenType === "") {
    return {
      status: "invalid-token-response",
      error: new ConnectError(
        "OAUTH_TOKEN_RESPONSE_INVALID",
        "token_type must be a non-empty string",
      ),
    };
  }

  const expiresInValue = obj["expires_in"];
  let expiresIn: number | undefined;
  if (expiresInValue !== undefined) {
    if (
      typeof expiresInValue !== "number" ||
      !Number.isFinite(expiresInValue) ||
      expiresInValue < 0
    ) {
      return {
        status: "invalid-token-response",
        error: new ConnectError(
          "OAUTH_TOKEN_RESPONSE_INVALID",
          "expires_in must be a finite non-negative number",
        ),
      };
    }
    expiresIn = expiresInValue;
  }

  const refreshTokenValue = obj["refresh_token"];
  let refreshToken: string | undefined;
  if (refreshTokenValue !== undefined) {
    if (typeof refreshTokenValue !== "string" || refreshTokenValue === "") {
      return {
        status: "invalid-token-response",
        error: new ConnectError(
          "OAUTH_TOKEN_RESPONSE_INVALID",
          "refresh_token must be a non-empty string",
        ),
      };
    }
    refreshToken = refreshTokenValue;
  }

  const scopeValue = obj["scope"];
  let scope: string | undefined;
  if (scopeValue !== undefined) {
    if (typeof scopeValue !== "string") {
      return {
        status: "invalid-token-response",
        error: new ConnectError("OAUTH_TOKEN_RESPONSE_INVALID", "scope must be a string"),
      };
    }
    scope = scopeValue;
  }

  return {
    status: "success",
    tokens: {
      accessToken,
      tokenType,
      ...(expiresIn !== undefined ? { expiresIn } : {}),
      ...(refreshToken !== undefined ? { refreshToken } : {}),
      ...(scope !== undefined ? { scope } : {}),
    },
  };
}

export {
  createProviderOAuthAuthorizationUrl,
  /** @internal Test seam for provider configs that are not in the public registry yet. */
  createProviderOAuthAuthorizationUrlForConfig,
  exchangeProviderOAuthCode,
  /** @internal Test seam for provider configs that are not in the public registry yet. */
  exchangeProviderOAuthCodeForConfig,
};
export type {
  OAuthClientAuthentication,
  ProviderOAuthAuthorizationUrlOptions,
  ProviderOAuthAuthorizationUrlResult,
  ProviderOAuthPkceChallenge,
  ProviderOAuthPkceVerifier,
  ProviderOAuthTokenExchangeOptions,
  ProviderOAuthTokenResult,
  ProviderOAuthTokens,
};
