import { describe, expect, it } from "vitest";

import { ConnectError } from "../connect-error";
import { createDnsRecord } from "../dns-record";
import { createRecordCheck, evaluateRecordChecks } from "./check-records";

const domain = "example.com";

describe("createRecordCheck", () => {
  it("matches exact A records", () => {
    const record = createDnsRecord({
      type: "A",
      name: domain,
      value: "192.0.2.10",
    });

    const result = createRecordCheck({
      record,
      resolver: "https://cloudflare-dns.com/dns-query",
      result: {
        status: "success",
        answers: [{ name: "example.com", type: 1, ttl: 300, data: "192.0.2.10" }],
      },
    });

    expect(result.check.status).toBe("found");
    expect(result.check.actualValues).toEqual(["192.0.2.10"]);
  });

  it("normalizes quoted TXT values", () => {
    const record = createDnsRecord({
      type: "TXT",
      name: domain,
      value: "redirectry-verify=abc123",
    });

    const result = createRecordCheck({
      record,
      resolver: "https://cloudflare-dns.com/dns-query",
      result: {
        status: "success",
        answers: [
          {
            name: "example.com",
            type: 16,
            ttl: 300,
            data: '"redirectry-verify=" "abc123"',
          },
        ],
      },
    });

    expect(result.check.status).toBe("found");
    expect(result.check.actualValues).toEqual(["redirectry-verify=abc123"]);
  });

  it("normalizes CNAME values with trailing dots", () => {
    const record = createDnsRecord({
      type: "CNAME",
      name: "www.example.com",
      value: "target.example.net",
    });

    const result = createRecordCheck({
      record,
      resolver: "https://cloudflare-dns.com/dns-query",
      result: {
        status: "success",
        answers: [
          {
            name: "www.example.com",
            type: 5,
            ttl: 300,
            data: "Target.Example.Net.",
          },
        ],
      },
    });

    expect(result.check.status).toBe("found");
    expect(result.check.actualValues).toEqual(["target.example.net"]);
  });

  it("normalizes equivalent AAAA values", () => {
    const record = createDnsRecord({
      type: "AAAA",
      name: domain,
      value: "2001:db8::1",
    });

    const result = createRecordCheck({
      record,
      resolver: "https://cloudflare-dns.com/dns-query",
      result: {
        status: "success",
        answers: [
          {
            name: "example.com",
            type: 28,
            ttl: 300,
            data: "2001:0DB8:0:0:0:0:0:1",
          },
        ],
      },
    });

    expect(result.check.status).toBe("found");
    expect(result.check.actualValues).toEqual(["2001:db8::1"]);
  });
});

describe("evaluateRecordChecks", () => {
  const record = createDnsRecord({
    type: "TXT",
    name: domain,
    value: "verification=token",
  });

  it("returns partially-propagated when some results match", () => {
    const status = evaluateRecordChecks({
      expected: [record],
      results: [
        {
          record,
          resolver: "resolver-1",
          status: "found",
          actualValues: ["verification=token"],
        },
        {
          record,
          resolver: "resolver-2",
          status: "not-found",
          actualValues: ["other"],
        },
      ],
    });

    expect(status).toBe("partially-propagated");
  });

  it("returns propagated when every check matches", () => {
    const status = evaluateRecordChecks({
      expected: [record],
      results: [
        {
          record,
          resolver: "resolver-1",
          status: "found",
          actualValues: ["verification=token"],
        },
        {
          record,
          resolver: "resolver-2",
          status: "found",
          actualValues: ["verification=token"],
        },
      ],
    });

    expect(status).toBe("propagated");
  });

  it("returns propagated when all reachable resolvers match", () => {
    const status = evaluateRecordChecks({
      expected: [record],
      results: [
        {
          record,
          resolver: "resolver-1",
          status: "found",
          actualValues: ["verification=token"],
        },
        {
          record,
          resolver: "resolver-2",
          status: "error",
          actualValues: [],
        },
      ],
    });

    expect(status).toBe("propagated");
  });

  it("returns pending when successful lookups find no matches", () => {
    const status = evaluateRecordChecks({
      expected: [record],
      results: [
        {
          record,
          resolver: "resolver-1",
          status: "not-found",
          actualValues: ["other"],
        },
        {
          record,
          resolver: "resolver-2",
          status: "not-found",
          actualValues: [],
        },
      ],
    });

    expect(status).toBe("pending");
  });

  it("returns error when every lookup fails", () => {
    const error = new ConnectError("DNS_LOOKUP_FAILED", "boom");

    const firstCheck = createRecordCheck({
      record,
      resolver: "resolver-1",
      result: { status: "error", error },
    });
    const secondCheck = createRecordCheck({
      record,
      resolver: "resolver-2",
      result: { status: "error", error },
    });

    const status = evaluateRecordChecks({
      expected: [record],
      results: [firstCheck.check, secondCheck.check],
    });

    expect(status).toBe("error");
  });
});
