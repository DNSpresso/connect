import { describe, expect, it } from "vitest";

import { ConnectError } from "../connect-error";
import { createDnsRecord } from "../dns-record";
import { type ProviderDefinition, PROVIDER_REGISTRY } from "../providers/provider-registry";
import { createSetupGuidance } from "./create-guidance";

const domain = "example.com";

describe("createSetupGuidance", () => {
  it("includes manual mode and detected provider details for a root A record", () => {
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
        detectionMethod: "nameserver-pattern",
        confidence: "medium",
        evidence: {
          nameservers: ["adam.ns.cloudflare.com"],
          matches: [
            {
              nameserver: "adam.ns.cloudflare.com",
              providerId: "cloudflare",
              matchedPattern: "*.ns.cloudflare.com",
            },
          ],
        },
      },
      records: [record],
      domain,
    });

    expect(guidance).toEqual({
      mode: "manual",
      provider: {
        status: "detected",
        providerId: "cloudflare",
        name: "Cloudflare",
        capabilities: {
          manual: true,
          domainConnect: "unknown",
          providerApi: "unknown",
        },
        detectionMethod: "nameserver-pattern",
        confidence: "medium",
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

  it("uses dnsSettings.baseUrl from structured provider metadata", () => {
    const record = createDnsRecord({
      type: "TXT",
      name: domain,
      value: "verification=token",
    });
    const provider: ProviderDefinition = {
      name: "Structured DNS",
      nameserverPatterns: ["*.structured.example"],
      dnsSettings: {
        baseUrl: "https://dns.example/settings",
        deepLinkStrategy: "domain-path",
      },
      capabilities: {
        manual: true,
        domainConnect: "unknown",
        providerApi: "unknown",
      },
      hostFieldStrategy: "at-symbol",
    };

    const guidance = createSetupGuidance({
      detection: {
        status: "detected",
        providerId: "godaddy",
        provider,
        nameservers: ["ns1.structured.example"],
        detectionMethod: "nameserver-pattern",
        confidence: "medium",
        evidence: {
          nameservers: ["ns1.structured.example"],
          matches: [
            {
              nameserver: "ns1.structured.example",
              providerId: "godaddy",
              matchedPattern: "*.structured.example",
            },
          ],
        },
      },
      records: [record],
      domain,
    });

    expect(guidance.mode).toBe("manual");
    expect(guidance.provider).toEqual({
      status: "detected",
      providerId: "godaddy",
      name: "Structured DNS",
      capabilities: {
        manual: true,
        domainConnect: "unknown",
        providerApi: "unknown",
      },
      detectionMethod: "nameserver-pattern",
      confidence: "medium",
    });
    expect(guidance.links).toEqual({
      dnsSettings: "https://dns.example/settings",
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
        detectionMethod: "nameserver-pattern",
        confidence: "medium",
        evidence: {
          nameservers: ["adam.ns.cloudflare.com"],
          matches: [
            {
              nameserver: "adam.ns.cloudflare.com",
              providerId: "cloudflare",
              matchedPattern: "*.ns.cloudflare.com",
            },
          ],
        },
      },
      records: [record],
      domain,
    });

    expect(guidance.mode).toBe("manual");
    expect(guidance.records[0]?.hostField).toBe("www");
  });

  it("returns a blank host field for OVH apex records", () => {
    const record = createDnsRecord({
      type: "TXT",
      name: domain,
      value: "verification=token",
    });

    const guidance = createSetupGuidance({
      detection: {
        status: "detected",
        providerId: "ovh",
        provider: PROVIDER_REGISTRY.ovh,
        nameservers: ["dns19.ovh.net"],
        detectionMethod: "nameserver-pattern",
        confidence: "medium",
        evidence: {
          nameservers: ["dns19.ovh.net"],
          matches: [
            {
              nameserver: "dns19.ovh.net",
              providerId: "ovh",
              matchedPattern: "*.ovh.net",
            },
          ],
        },
      },
      records: [record],
      domain,
    });

    expect(guidance.records[0]?.hostField).toBe("");
  });

  it("returns generic manual guidance for an unknown provider", () => {
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

    expect(guidance.mode).toBe("manual");
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

    expect(guidance.mode).toBe("manual");
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

  it("returns a blank host field for apex records when strategy is blank", () => {
    const record = createDnsRecord({
      type: "TXT",
      name: domain,
      value: "verification=token",
    });
    const provider: ProviderDefinition = {
      name: "Blank Strategy DNS",
      nameserverPatterns: ["*.blank.example"],
      capabilities: {
        manual: true,
        domainConnect: "unknown",
        providerApi: "unknown",
      },
      hostFieldStrategy: "blank",
    };

    const guidance = createSetupGuidance({
      detection: {
        status: "detected",
        providerId: "cloudflare",
        provider,
        nameservers: ["ns1.blank.example"],
        detectionMethod: "nameserver-pattern",
        confidence: "medium",
        evidence: {
          nameservers: ["ns1.blank.example"],
          matches: [
            {
              nameserver: "ns1.blank.example",
              providerId: "cloudflare",
              matchedPattern: "*.blank.example",
            },
          ],
        },
      },
      records: [record],
      domain,
    });

    expect(guidance.records[0]?.hostField).toBe("");
  });

  it("returns the full domain for apex records when strategy is full-domain", () => {
    const record = createDnsRecord({
      type: "TXT",
      name: domain,
      value: "verification=token",
    });
    const provider: ProviderDefinition = {
      name: "Full Domain Strategy DNS",
      nameserverPatterns: ["*.full.example"],
      capabilities: {
        manual: true,
        domainConnect: "unknown",
        providerApi: "unknown",
      },
      hostFieldStrategy: "full-domain",
    };

    const guidance = createSetupGuidance({
      detection: {
        status: "detected",
        providerId: "cloudflare",
        provider,
        nameservers: ["ns1.full.example"],
        detectionMethod: "nameserver-pattern",
        confidence: "medium",
        evidence: {
          nameservers: ["ns1.full.example"],
          matches: [
            {
              nameserver: "ns1.full.example",
              providerId: "cloudflare",
              matchedPattern: "*.full.example",
            },
          ],
        },
      },
      records: [record],
      domain,
    });

    expect(guidance.records[0]?.hostField).toBe("example.com");
  });

  it("returns the full record name for subdomain records when strategy is full-domain", () => {
    const record = createDnsRecord({
      type: "CNAME",
      name: "www.example.com",
      value: "target.example.net",
    });
    const provider: ProviderDefinition = {
      name: "Full Domain Strategy DNS",
      nameserverPatterns: ["*.full.example"],
      capabilities: {
        manual: true,
        domainConnect: "unknown",
        providerApi: "unknown",
      },
      hostFieldStrategy: "full-domain",
    };

    const guidance = createSetupGuidance({
      detection: {
        status: "detected",
        providerId: "cloudflare",
        provider,
        nameservers: ["ns1.full.example"],
        detectionMethod: "nameserver-pattern",
        confidence: "medium",
        evidence: {
          nameservers: ["ns1.full.example"],
          matches: [
            {
              nameserver: "ns1.full.example",
              providerId: "cloudflare",
              matchedPattern: "*.full.example",
            },
          ],
        },
      },
      records: [record],
      domain,
    });

    expect(guidance.records[0]?.hostField).toBe("www.example.com");
  });
});
