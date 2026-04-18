import { describe, expect, it } from "vitest";

import { ConnectError } from "./connect-error";
import { assertDomainName, parseDomainName } from "./domain-name";

describe("parseDomainName", () => {
  it("accepts a valid domain", () => {
    const result = parseDomainName({ value: "example.com" });

    expect(result).toEqual({ status: "success", domain: "example.com" });
  });

  it("rejects invalid domains", () => {
    const invalidValues = ["example", "-example.com", "example-.com", "exa_mple.com"];

    for (const value of invalidValues) {
      const result = parseDomainName({ value });

      expect(result.status).toBe("invalid-domain");
      if (result.status === "invalid-domain") {
        expect(result.error).toBeInstanceOf(ConnectError);
        expect(result.error.code).toBe("INVALID_DOMAIN");
      }
    }
  });

  it("strips a trailing dot", () => {
    const result = parseDomainName({ value: "example.com." });

    expect(result).toEqual({ status: "success", domain: "example.com" });
  });

  it("normalizes case", () => {
    const result = parseDomainName({ value: "ExAmPlE.CoM" });

    expect(result).toEqual({ status: "success", domain: "example.com" });
  });

  it("trims whitespace", () => {
    const result = parseDomainName({ value: "  example.com  " });

    expect(result).toEqual({ status: "success", domain: "example.com" });
  });
});

describe("assertDomainName", () => {
  it("throws for invalid domains", () => {
    expect(() => assertDomainName({ value: "invalid" })).toThrowError(ConnectError);
  });

  it("returns a branded domain for valid input", () => {
    const domain = assertDomainName({ value: "Example.com" });

    expect(domain).toBe("example.com");
  });
});
