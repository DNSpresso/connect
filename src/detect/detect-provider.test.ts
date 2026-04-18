import { describe, expect, it } from "vitest";

import { ConnectError } from "../connect-error";
import { type DnsQueryResult, type DnsQueryTransport } from "../dns-transport";
import { detectProvider } from "./detect-provider";

type TransportCall = {
  readonly name: string;
  readonly type: string;
  readonly resolver?: string | undefined;
  readonly signal?: AbortSignal | undefined;
};

function createMockTransport(options: {
  result: DnsQueryResult;
  calls?: TransportCall[];
}): DnsQueryTransport {
  return async ({ name, type, resolver, signal }) => {
    options.calls?.push({ name, type, resolver, signal });
    return options.result;
  };
}

describe("detectProvider", () => {
  it("detects a known provider", async () => {
    const transport = createMockTransport({
      result: {
        status: "success",
        answers: [{ name: "example.com", type: 2, ttl: 300, data: "adam.ns.cloudflare.com" }],
      },
    });

    const result = await detectProvider({
      domain: "example.com",
      transport,
    });

    expect(result).toMatchObject({
      status: "detected",
      providerId: "cloudflare",
      matchedPattern: "*.ns.cloudflare.com",
    });
  });

  it("returns unknown-provider for unmatched nameservers", async () => {
    const transport = createMockTransport({
      result: {
        status: "success",
        answers: [{ name: "example.com", type: 2, ttl: 300, data: "ns1.custom-dns.example" }],
      },
    });

    const result = await detectProvider({
      domain: "example.com",
      transport,
    });

    expect(result).toEqual({
      status: "unknown-provider",
      nameservers: ["ns1.custom-dns.example"],
    });
  });

  it("normalizes nameservers with a trailing dot", async () => {
    const transport = createMockTransport({
      result: {
        status: "success",
        answers: [{ name: "example.com", type: 2, ttl: 300, data: "adam.ns.cloudflare.com." }],
      },
    });

    const result = await detectProvider({
      domain: "example.com",
      transport,
    });

    expect(result).toMatchObject({
      status: "detected",
      providerId: "cloudflare",
      nameservers: ["adam.ns.cloudflare.com"],
    });
  });

  it("normalizes mixed-case nameservers", async () => {
    const transport = createMockTransport({
      result: {
        status: "success",
        answers: [{ name: "example.com", type: 2, ttl: 300, data: "Adam.NS.Cloudflare.COM" }],
      },
    });

    const result = await detectProvider({
      domain: "example.com",
      transport,
    });

    expect(result).toMatchObject({
      status: "detected",
      providerId: "cloudflare",
      nameservers: ["adam.ns.cloudflare.com"],
    });
  });

  it("returns lookup-failed when the transport fails", async () => {
    const error = new ConnectError("DNS_LOOKUP_FAILED", "boom");
    const transport = createMockTransport({
      result: { status: "error", error },
    });

    const result = await detectProvider({
      domain: "example.com",
      transport,
    });

    expect(result).toEqual({ status: "lookup-failed", error });
  });

  it("detects a provider when one of multiple nameservers matches", async () => {
    const transport = createMockTransport({
      result: {
        status: "success",
        answers: [
          { name: "example.com", type: 2, ttl: 300, data: "ns1.custom-dns.example" },
          { name: "example.com", type: 2, ttl: 300, data: "adam.ns.cloudflare.com" },
        ],
      },
    });

    const result = await detectProvider({
      domain: "example.com",
      transport,
    });

    expect(result).toMatchObject({
      status: "detected",
      providerId: "cloudflare",
    });
  });

  it("queries the exact domain as provided", async () => {
    const calls: TransportCall[] = [];
    const transport = createMockTransport({
      calls,
      result: {
        status: "success",
        answers: [{ name: "foo.example.com", type: 2, ttl: 300, data: "ns1.custom-dns.example" }],
      },
    });
    const domain = "foo.example.com";

    await detectProvider({ domain, transport });

    expect(calls).toEqual([
      {
        name: "foo.example.com",
        type: "NS",
        resolver: undefined,
        signal: undefined,
      },
    ]);
  });
});
