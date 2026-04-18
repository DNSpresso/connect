import { describe, expect, it } from "vitest";

import { ConnectError } from "../connect-error";
import { createDnsRecord } from "../dns-record";
import { PROVIDER_REGISTRY } from "../providers/provider-registry";
import { createSetupGuidance } from "./create-guidance";

const domain = "example.com";

describe("createSetupGuidance", () => {
  it("includes detected provider details for a root A record", () => {
    const record = createDnsRecord({
      type: "A",
      name: domain,
      value: "192.0.2.10",
    });

    const guidance = createSetupGuidance({
      detection: {
        status: "detected",
        providerId: "cloudflare",
        provider: PROVIDER_REGISTRY.cloudflare,
        nameservers: ["adam.ns.cloudflare.com"],
        matchedPattern: "*.ns.cloudflare.com",
      },
      records: [record],
      domain,
    });

    expect(guidance).toEqual({
      provider: {
        status: "detected",
        providerId: "cloudflare",
        name: "Cloudflare",
      },
      records: [
        {
          record,
          hostField: "@",
          valueField: "192.0.2.10",
          ttlField: 300,
        },
      ],
      links: {
        dnsSettings: "https://dash.cloudflare.com/",
      },
      notes: [
        "Changes may take time to propagate",
        "Disable Cloudflare proxy (orange cloud) for CNAME records used in domain verification.",
      ],
    });
  });

  it("strips the zone suffix for subdomain records", () => {
    const record = createDnsRecord({
      type: "CNAME",
      name: "www.example.com",
      value: "target.example.net",
    });

    const guidance = createSetupGuidance({
      detection: {
        status: "detected",
        providerId: "cloudflare",
        provider: PROVIDER_REGISTRY.cloudflare,
        nameservers: ["adam.ns.cloudflare.com"],
        matchedPattern: "*.ns.cloudflare.com",
      },
      records: [record],
      domain,
    });

    expect(guidance.records[0]?.hostField).toBe("www");
  });

  it("returns generic guidance for an unknown provider", () => {
    const record = createDnsRecord({
      type: "TXT",
      name: domain,
      value: "verification=token",
    });

    const guidance = createSetupGuidance({
      detection: {
        status: "unknown-provider",
        nameservers: ["ns1.custom-dns.example"],
      },
      records: [record],
      domain,
    });

    expect(guidance.provider).toEqual({ status: "unknown-provider" });
    expect(guidance.links).toEqual({});
    expect(guidance.records[0]?.ttlField).toBe(300);
  });

  it("preserves a lookup-failed detection state", () => {
    const record = createDnsRecord({
      type: "TXT",
      name: domain,
      value: "verification=token",
    });
    const error = new ConnectError("DNS_LOOKUP_FAILED", "boom");

    const guidance = createSetupGuidance({
      detection: {
        status: "lookup-failed",
        error,
      },
      records: [record],
      domain,
    });

    expect(guidance.provider).toEqual({ status: "lookup-failed", error });
  });

  it("uses a custom TTL when provided", () => {
    const record = createDnsRecord({
      type: "TXT",
      name: domain,
      value: "verification=token",
      ttl: 900,
    });

    const guidance = createSetupGuidance({
      detection: {
        status: "unknown-provider",
        nameservers: ["ns1.custom-dns.example"],
      },
      records: [record],
      domain,
    });

    expect(guidance.records[0]?.ttlField).toBe(900);
  });

  it("does not strip unrelated domain suffixes", () => {
    const record = createDnsRecord({
      type: "TXT",
      name: "otherexample.com",
      value: "verification=token",
    });

    const guidance = createSetupGuidance({
      detection: {
        status: "unknown-provider",
        nameservers: ["ns1.custom-dns.example"],
      },
      records: [record],
      domain,
    });

    expect(guidance.records[0]?.hostField).toBe("otherexample.com");
  });
});
