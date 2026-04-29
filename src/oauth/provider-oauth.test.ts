import { describe, expect, it } from "vitest";

import { ConnectError } from "../connect-error";
import {
  createProviderOAuthAuthorizationUrl,
  createProviderOAuthAuthorizationUrlForConfig,
  exchangeProviderOAuthCode,
  exchangeProviderOAuthCodeForConfig,
} from "./provider-oauth";
import type { OAuthTokenExchangeTransport } from "./oauth-token-exchange";

const TEST_OAUTH_CONFIG = {
  authorizationUrl: "https://provider.example.com/oauth/authorize",
  tokenUrl: "https://provider.example.com/oauth/token",
  defaultScopes: ["dns:read", "dns:write"],
  supportsPkce: true,
} as const;

const TEST_OAUTH_CONFIG_NO_PKCE = {
  ...TEST_OAUTH_CONFIG,
  supportsPkce: false,
} as const;

function createSuccessTransport(payload: unknown): OAuthTokenExchangeTransport {
  return async () => ({ status: "success", payload });
}

function createErrorTransport(error: ConnectError): OAuthTokenExchangeTransport {
  return async () => ({ status: "error", error });
}

describe("createProviderOAuthAuthorizationUrl", () => {
  it("returns provider-not-configured for a real provider without oauth", () => {
    const result = createProviderOAuthAuthorizationUrl({
      providerId: "cloudflare",
      clientId: "test-client",
      redirectUri: "https://app.example.com/callback",
      state: "state-123",
    });

    expect(result).toMatchObject({
      status: "provider-not-configured",
      error: expect.any(ConnectError),
    });
    expect((result as { readonly error: ConnectError }).error.code).toBe(
      "OAUTH_PROVIDER_NOT_CONFIGURED",
    );
  });
});

describe("createProviderOAuthAuthorizationUrlForConfig", () => {
  it("returns success with default scopes, state, redirect URI, client ID, and PKCE", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      clientId: "test-client",
      redirectUri: "https://app.example.com/callback",
      state: "state-123",
      pkce: { codeChallenge: "challenge-abc", codeChallengeMethod: "S256" },
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    const url = new URL(result.url);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("test-client");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/callback");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("scope")).toBe("dns:read dns:write");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-abc");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("returns success with explicit scopes overriding defaults", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      clientId: "test-client",
      redirectUri: "https://app.example.com/callback",
      state: "state-123",
      scopes: ["custom:scope"],
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(new URL(result.url).searchParams.get("scope")).toBe("custom:scope");
  });

  it("omits scope when selected scopes are empty", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: { ...TEST_OAUTH_CONFIG, defaultScopes: [] },
      clientId: "test-client",
      redirectUri: "https://app.example.com/callback",
      state: "state-123",
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(new URL(result.url).searchParams.has("scope")).toBe(false);
  });

  it("returns success with extraParams overriding a standard param", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      clientId: "test-client",
      redirectUri: "https://app.example.com/callback",
      state: "state-123",
      extraParams: { state: "overridden-state" },
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(new URL(result.url).searchParams.get("state")).toBe("overridden-state");
  });

  it("returns invalid-request for empty clientId", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      clientId: "",
      redirectUri: "https://app.example.com/callback",
      state: "state-123",
    });

    expect(result).toMatchObject({ status: "invalid-request", error: expect.any(ConnectError) });
    expect((result as { readonly error: ConnectError }).error.code).toBe("OAUTH_INVALID_REQUEST");
  });

  it("returns invalid-request for whitespace-only clientId", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      clientId: "   ",
      redirectUri: "https://app.example.com/callback",
      state: "state-123",
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for empty redirectUri", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      clientId: "test-client",
      redirectUri: "",
      state: "state-123",
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for whitespace-only redirectUri", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      clientId: "test-client",
      redirectUri: "   ",
      state: "state-123",
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for malformed redirectUri", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      clientId: "test-client",
      redirectUri: "not-a-url",
      state: "state-123",
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for empty state", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      clientId: "test-client",
      redirectUri: "https://app.example.com/callback",
      state: "",
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for whitespace-only state", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      clientId: "test-client",
      redirectUri: "https://app.example.com/callback",
      state: "   ",
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for empty scope", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      clientId: "test-client",
      redirectUri: "https://app.example.com/callback",
      state: "state-123",
      scopes: [""],
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for whitespace-only scope", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      clientId: "test-client",
      redirectUri: "https://app.example.com/callback",
      state: "state-123",
      scopes: ["   "],
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for PKCE on non-PKCE provider", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG_NO_PKCE,
      clientId: "test-client",
      redirectUri: "https://app.example.com/callback",
      state: "state-123",
      pkce: { codeChallenge: "challenge-abc", codeChallengeMethod: "S256" },
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for empty codeChallenge", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      clientId: "test-client",
      redirectUri: "https://app.example.com/callback",
      state: "state-123",
      pkce: { codeChallenge: "", codeChallengeMethod: "S256" },
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for empty extraParams key", () => {
    const result = createProviderOAuthAuthorizationUrlForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      clientId: "test-client",
      redirectUri: "https://app.example.com/callback",
      state: "state-123",
      extraParams: { "": "value" },
    });

    expect(result.status).toBe("invalid-request");
  });
});

describe("exchangeProviderOAuthCode", () => {
  it("returns provider-not-configured for a real provider without oauth", async () => {
    const result = await exchangeProviderOAuthCode({
      providerId: "cloudflare",
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
    });

    expect(result).toMatchObject({
      status: "provider-not-configured",
      error: expect.any(ConnectError),
    });
    expect((result as { readonly error: ConnectError }).error.code).toBe(
      "OAUTH_PROVIDER_NOT_CONFIGURED",
    );
  });
});

describe("exchangeProviderOAuthCodeForConfig", () => {
  it("returns success with full response", async () => {
    const transport = createSuccessTransport({
      access_token: "access-123",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "refresh-456",
      scope: "dns:read dns:write",
    });

    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      transport,
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.tokens.accessToken).toBe("access-123");
    expect(result.tokens.tokenType).toBe("Bearer");
    expect(result.tokens.expiresIn).toBe(3600);
    expect(result.tokens.refreshToken).toBe("refresh-456");
    expect(result.tokens.scope).toBe("dns:read dns:write");
  });

  it("returns success with minimal response", async () => {
    const transport = createSuccessTransport({
      access_token: "access-123",
      token_type: "Bearer",
    });

    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      transport,
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.tokens.accessToken).toBe("access-123");
    expect(result.tokens.tokenType).toBe("Bearer");
    expect(result.tokens.expiresIn).toBeUndefined();
    expect(result.tokens.refreshToken).toBeUndefined();
    expect(result.tokens.scope).toBeUndefined();
  });

  it("body contains expected grant fields", async () => {
    let capturedBody: URLSearchParams | undefined;

    const transport = async (request: { body: URLSearchParams }) => {
      capturedBody = request.body;
      return {
        status: "success" as const,
        payload: { access_token: "access-123", token_type: "Bearer" },
      };
    };

    await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      pkce: { codeVerifier: "verifier-xyz" },
      transport,
    });

    expect(capturedBody).toBeDefined();
    expect(capturedBody!.get("grant_type")).toBe("authorization_code");
    expect(capturedBody!.get("code")).toBe("auth-code");
    expect(capturedBody!.get("redirect_uri")).toBe("https://app.example.com/callback");
    expect(capturedBody!.get("client_id")).toBe("test-client");
    expect(capturedBody!.get("code_verifier")).toBe("verifier-xyz");
  });

  it("body auth adds client_secret", async () => {
    let capturedBody: URLSearchParams | undefined;

    const transport = async (request: { body: URLSearchParams }) => {
      capturedBody = request.body;
      return {
        status: "success" as const,
        payload: { access_token: "access-123", token_type: "Bearer" },
      };
    };

    await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      clientAuthentication: { method: "body", clientSecret: "secret-123" },
      transport,
    });

    expect(capturedBody!.get("client_secret")).toBe("secret-123");
  });

  it("no-auth omits client_secret", async () => {
    let capturedBody: URLSearchParams | undefined;

    const transport = async (request: { body: URLSearchParams }) => {
      capturedBody = request.body;
      return {
        status: "success" as const,
        payload: { access_token: "access-123", token_type: "Bearer" },
      };
    };

    await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      transport,
    });

    expect(capturedBody!.has("client_secret")).toBe(false);
  });

  it("basic auth sets Authorization header", async () => {
    let capturedHeaders: Readonly<Record<string, string>> | undefined;

    const transport = async (request: { headers: Readonly<Record<string, string>> }) => {
      capturedHeaders = request.headers;
      return {
        status: "success" as const,
        payload: { access_token: "access-123", token_type: "Bearer" },
      };
    };

    await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      clientAuthentication: { method: "basic", clientSecret: "secret-123" },
      transport,
    });

    expect(capturedHeaders).toBeDefined();
    const expectedCredentials = btoa("test-client:secret-123");
    expect(capturedHeaders!["Authorization"]).toBe(`Basic ${expectedCredentials}`);
  });

  it("returns invalid-request for empty code", async () => {
    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for whitespace-only code", async () => {
    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "   ",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for empty redirectUri", async () => {
    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "",
      clientId: "test-client",
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for malformed redirectUri", async () => {
    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "not-a-url",
      clientId: "test-client",
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for empty clientId", async () => {
    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "",
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for empty verifier", async () => {
    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      pkce: { codeVerifier: "" },
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for PKCE on non-PKCE provider", async () => {
    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG_NO_PKCE,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      pkce: { codeVerifier: "verifier-xyz" },
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for empty client secret with body auth", async () => {
    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      clientAuthentication: { method: "body", clientSecret: "" },
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns invalid-request for empty client secret with basic auth", async () => {
    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      clientAuthentication: { method: "basic", clientSecret: "" },
    });

    expect(result.status).toBe("invalid-request");
  });

  it("returns exchange-failed and preserves transport error", async () => {
    const transportError = new ConnectError("OAUTH_TOKEN_EXCHANGE_FAILED", "Network error");
    const transport = createErrorTransport(transportError);

    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      transport,
    });

    expect(result).toMatchObject({ status: "exchange-failed", error: expect.any(ConnectError) });
    const typed = result as { readonly error: ConnectError };
    expect(typed.error).toBe(transportError);
  });

  it("returns invalid-token-response for null payload", async () => {
    const transport = createSuccessTransport(null);

    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      transport,
    });

    expect(result.status).toBe("invalid-token-response");
  });

  it("returns invalid-token-response for missing access_token", async () => {
    const transport = createSuccessTransport({ token_type: "Bearer" });

    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      transport,
    });

    expect(result.status).toBe("invalid-token-response");
  });

  it("returns invalid-token-response for missing token_type", async () => {
    const transport = createSuccessTransport({ access_token: "access-123" });

    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      transport,
    });

    expect(result.status).toBe("invalid-token-response");
  });

  it("returns invalid-token-response for non-string access_token", async () => {
    const transport = createSuccessTransport({ access_token: 123, token_type: "Bearer" });

    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      transport,
    });

    expect(result.status).toBe("invalid-token-response");
  });

  it("returns invalid-token-response for empty token_type", async () => {
    const transport = createSuccessTransport({ access_token: "access-123", token_type: "" });

    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      transport,
    });

    expect(result.status).toBe("invalid-token-response");
  });

  it("returns invalid-token-response for negative expires_in", async () => {
    const transport = createSuccessTransport({
      access_token: "access-123",
      token_type: "Bearer",
      expires_in: -1,
    });

    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      transport,
    });

    expect(result.status).toBe("invalid-token-response");
  });

  it("returns invalid-token-response for non-finite expires_in", async () => {
    const transport = createSuccessTransport({
      access_token: "access-123",
      token_type: "Bearer",
      expires_in: Infinity,
    });

    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      transport,
    });

    expect(result.status).toBe("invalid-token-response");
  });

  it("returns invalid-token-response for string expires_in", async () => {
    const transport = createSuccessTransport({
      access_token: "access-123",
      token_type: "Bearer",
      expires_in: "3600",
    });

    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      transport,
    });

    expect(result.status).toBe("invalid-token-response");
  });

  it("returns invalid-token-response for non-string refresh_token", async () => {
    const transport = createSuccessTransport({
      access_token: "access-123",
      token_type: "Bearer",
      refresh_token: 123,
    });

    const result = await exchangeProviderOAuthCodeForConfig({
      providerId: "cloudflare",
      oauth: TEST_OAUTH_CONFIG,
      code: "auth-code",
      redirectUri: "https://app.example.com/callback",
      clientId: "test-client",
      transport,
    });

    expect(result.status).toBe("invalid-token-response");
  });
});
