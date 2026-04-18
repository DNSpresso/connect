import { describe, expect, it } from "vitest";

import { matchProvider } from "./provider-match";

describe("matchProvider", () => {
  it("matches Cloudflare nameservers", () => {
    const result = matchProvider({ nameservers: ["adam.ns.cloudflare.com"] });

    expect(result?.providerId).toBe("cloudflare");
  });

  it("matches GoDaddy nameservers", () => {
    const result = matchProvider({ nameservers: ["ns01.domaincontrol.com"] });

    expect(result?.providerId).toBe("godaddy");
  });

  it("matches Namecheap nameservers", () => {
    const result = matchProvider({ nameservers: ["dns1.registrar-servers.com"] });

    expect(result?.providerId).toBe("namecheap");
  });

  it("matches Route 53 nameservers", () => {
    const result = matchProvider({ nameservers: ["ns-123.awsdns-45.org"] });

    expect(result?.providerId).toBe("route53");
  });

  it("matches Porkbun nameservers", () => {
    const result = matchProvider({ nameservers: ["curitiba.ns.porkbun.com"] });

    expect(result?.providerId).toBe("porkbun");
  });

  it("returns undefined for unknown nameservers", () => {
    const result = matchProvider({ nameservers: ["ns1.custom-dns.example"] });

    expect(result).toBeUndefined();
  });

  it("normalizes a trailing dot", () => {
    const result = matchProvider({ nameservers: ["adam.ns.cloudflare.com."] });

    expect(result?.providerId).toBe("cloudflare");
    expect(result?.matchedNameserver).toBe("adam.ns.cloudflare.com");
  });

  it("normalizes mixed case", () => {
    const result = matchProvider({ nameservers: ["Adam.NS.Cloudflare.COM"] });

    expect(result?.providerId).toBe("cloudflare");
    expect(result?.matchedNameserver).toBe("adam.ns.cloudflare.com");
  });

  it("does not collide between providers", () => {
    const result = matchProvider({ nameservers: ["adam.ns.cloudflare.com"] });

    expect(result?.providerId).toBe("cloudflare");
    expect(result?.matchedPattern).not.toContain("awsdns");
  });
});
