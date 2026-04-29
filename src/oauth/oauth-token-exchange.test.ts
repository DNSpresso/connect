import { describe, expect, it } from "vitest";

import { createOAuthTokenExchangeTransport } from "./oauth-token-exchange";

function createJsonResponseFetch(payload: unknown, status = 200) {
  return async () => new Response(JSON.stringify(payload), { status });
}

function createTextResponseFetch(text: string, status: number) {
  return async () => new Response(text, { status });
}

function createThrowingFetch(error: Error) {
  return async () => {
    throw error;
  };
}

function createCapturingFetch(
  capturedInit: { value?: RequestInit | undefined },
  response?: Response,
) {
  return async (_url: string | URL | Request, init?: RequestInit) => {
    capturedInit.value = init;
    return response ?? new Response(JSON.stringify({}), { status: 200 });
  };
}

describe("createOAuthTokenExchangeTransport", () => {
  it("returns success payload for 200 OK + JSON", async () => {
    const transport = createOAuthTokenExchangeTransport({
      fetch: createJsonResponseFetch({ access_token: "token-123" }),
    });
    const result = await transport({
      url: "https://example.com/token",
      body: new URLSearchParams({ grant_type: "authorization_code" }),
      headers: {},
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.payload).toEqual({ access_token: "token-123" });
  });

  it("returns exchange-failed for 200 OK + non-JSON", async () => {
    const transport = createOAuthTokenExchangeTransport({
      fetch: createTextResponseFetch("not json", 200),
    });
    const result = await transport({
      url: "https://example.com/token",
      body: new URLSearchParams(),
      headers: {},
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.error.code).toBe("OAUTH_TOKEN_EXCHANGE_FAILED");
  });

  it("returns exchange-failed for non-2xx and mentions status", async () => {
    const transport = createOAuthTokenExchangeTransport({
      fetch: createTextResponseFetch("Unauthorized", 401),
    });
    const result = await transport({
      url: "https://example.com/token",
      body: new URLSearchParams(),
      headers: {},
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.error.code).toBe("OAUTH_TOKEN_EXCHANGE_FAILED");
    expect(result.error.message).toContain("401");
  });

  it("returns exchange-failed when fetch throws", async () => {
    const transport = createOAuthTokenExchangeTransport({
      fetch: createThrowingFetch(new Error("Network failure")),
    });
    const result = await transport({
      url: "https://example.com/token",
      body: new URLSearchParams(),
      headers: {},
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.error.code).toBe("OAUTH_TOKEN_EXCHANGE_FAILED");
    expect(result.error.cause).toBeInstanceOf(Error);
  });

  it("returns exchange-failed when fetch is undefined and global fetch is unavailable", async () => {
    const originalFetch = globalThis.fetch;
    // @ts-expect-error — intentionally removing fetch for this test
    globalThis.fetch = undefined;

    const transport = createOAuthTokenExchangeTransport();
    const result = await transport({
      url: "https://example.com/token",
      body: new URLSearchParams(),
      headers: {},
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.error.code).toBe("OAUTH_TOKEN_EXCHANGE_FAILED");

    globalThis.fetch = originalFetch;
  });

  it("forwards signal in fetch init", async () => {
    const controller = new AbortController();
    const capturedInit: { value?: RequestInit } = {};

    const transport = createOAuthTokenExchangeTransport({
      fetch: createCapturingFetch(capturedInit),
    });
    await transport({
      url: "https://example.com/token",
      body: new URLSearchParams(),
      headers: {},
      signal: controller.signal,
    });

    expect(capturedInit.value?.signal).toBe(controller.signal);
  });

  it("includes default headers and caller-supplied overrides", async () => {
    const capturedInit: { value?: RequestInit } = {};

    const transport = createOAuthTokenExchangeTransport({
      fetch: createCapturingFetch(capturedInit),
    });
    await transport({
      url: "https://example.com/token",
      body: new URLSearchParams(),
      headers: { Authorization: "Basic abc123", "X-Custom": "value" },
    });

    const headers = capturedInit.value?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(headers["Accept"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Basic abc123");
    expect(headers["X-Custom"]).toBe("value");
  });

  it("body is the same URLSearchParams instance supplied", async () => {
    const body = new URLSearchParams({ grant_type: "authorization_code" });
    const capturedInit: { value?: RequestInit } = {};

    const transport = createOAuthTokenExchangeTransport({
      fetch: createCapturingFetch(capturedInit),
    });
    await transport({
      url: "https://example.com/token",
      body,
      headers: {},
    });

    expect(capturedInit.value?.body).toBe(body);
  });
});
