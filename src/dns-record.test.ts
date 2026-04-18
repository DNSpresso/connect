import { describe, expect, it } from "vitest";

import { ConnectError } from "./connect-error";
import { createDnsRecord } from "./dns-record";

const domain = "example.com";
const subdomain = "www.example.com";

describe("createDnsRecord", () => {
  it("creates an A record", () => {
    const record = createDnsRecord({
      type: "A",
      name: domain,
      value: "192.0.2.10",
      ttl: 600,
    });

    expect(record).toEqual({
      type: "A",
      name: domain,
      value: "192.0.2.10",
      ttl: 600,
    });
  });

  it("creates an AAAA record", () => {
    const record = createDnsRecord({
      type: "AAAA",
      name: domain,
      value: "2001:DB8::1",
    });

    expect(record).toEqual({
      type: "AAAA",
      name: domain,
      value: "2001:db8::1",
      ttl: undefined,
    });
  });

  it("canonicalizes equivalent AAAA input", () => {
    const record = createDnsRecord({
      type: "AAAA",
      name: domain,
      value: "2001:0DB8:0:0:0:0:0:1",
    });

    expect(record).toEqual({
      type: "AAAA",
      name: domain,
      value: "2001:db8::1",
      ttl: undefined,
    });
  });

  it("creates a CNAME record", () => {
    const record = createDnsRecord({
      type: "CNAME",
      name: subdomain,
      value: "target.example.net.",
    });

    expect(record).toEqual({
      type: "CNAME",
      name: subdomain,
      value: "target.example.net",
      ttl: undefined,
    });
  });

  it("creates a TXT record", () => {
    const record = createDnsRecord({
      type: "TXT",
      name: domain,
      value: "verification=token",
    });

    expect(record).toEqual({
      type: "TXT",
      name: domain,
      value: "verification=token",
      ttl: undefined,
    });
  });

  it("rejects invalid IPv4 values", () => {
    expect(() => createDnsRecord({ type: "A", name: domain, value: "256.0.0.1" })).toThrowError(
      ConnectError,
    );
    expect(() =>
      createDnsRecord({ type: "A", name: domain, value: "001.002.003.004" }),
    ).toThrowError(ConnectError);
  });

  it("rejects invalid IPv6 values", () => {
    expect(() => createDnsRecord({ type: "AAAA", name: domain, value: "not-an-ip" })).toThrowError(
      ConnectError,
    );
  });

  it("rejects invalid CNAME values", () => {
    expect(() =>
      createDnsRecord({ type: "CNAME", name: subdomain, value: "bad target" }),
    ).toThrowError(ConnectError);
  });

  it("preserves a provided TTL", () => {
    const record = createDnsRecord({
      type: "TXT",
      name: domain,
      value: "value",
      ttl: 300,
    });

    expect(record.ttl).toBe(300);
  });

  it("allows an omitted TTL", () => {
    const record = createDnsRecord({
      type: "TXT",
      name: domain,
      value: "value",
    });

    expect(record.ttl).toBeUndefined();
  });
});
