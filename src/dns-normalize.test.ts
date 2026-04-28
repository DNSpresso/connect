import { describe, expect, it } from "vitest";

import { normalizeDnsHostname, normalizeTxtValue } from "./dns-normalize";

describe("normalizeDnsHostname", () => {
  it("lowercases", () => {
    expect(normalizeDnsHostname({ value: "Adam.NS.Cloudflare.COM" })).toBe(
      "adam.ns.cloudflare.com",
    );
  });

  it("trims whitespace", () => {
    expect(normalizeDnsHostname({ value: "  example.com  " })).toBe("example.com");
  });

  it("strips trailing dot", () => {
    expect(normalizeDnsHostname({ value: "example.com." })).toBe("example.com");
  });
});

describe("normalizeTxtValue", () => {
  it("strips outer quotes", () => {
    expect(normalizeTxtValue({ value: '"hello world"' })).toBe("hello world");
  });

  it("joins multiple quoted segments without spaces", () => {
    expect(normalizeTxtValue({ value: '"hello" "world"' })).toBe("helloworld");
  });

  it("handles escaped quotes inside quoted segments", () => {
    expect(normalizeTxtValue({ value: '"say \\"hello\\""' })).toBe('say "hello"');
  });

  it("handles escaped backslashes inside quoted segments", () => {
    expect(normalizeTxtValue({ value: '"path\\\\to\\\\file"' })).toBe("path\\to\\file");
  });

  it("returns unquoted value as-is", () => {
    expect(normalizeTxtValue({ value: "plain-text" })).toBe("plain-text");
  });

  it("ignores unquoted content outside quoted segments", () => {
    expect(normalizeTxtValue({ value: 'prefix "quoted" suffix' })).toBe("quoted");
  });
});
