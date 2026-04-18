import { z } from "zod";

import { ConnectError } from "./connect-error";
import { type DomainName, parseDomainName } from "./domain-name";

const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "TXT"] as const;
const ttlSchema = z.int().positive();
const ipv4AddressSchema = z.ipv4();
const ipv6AddressSchema = z.ipv6();

type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];
type Ipv4Address = string & { readonly __brand: "Ipv4Address" };
type Ipv6Address = string & { readonly __brand: "Ipv6Address" };
type Hostname = string & { readonly __brand: "Hostname" };

type DnsRecord =
  | {
      readonly type: "A";
      readonly name: DomainName;
      readonly value: Ipv4Address;
      readonly ttl?: number | undefined;
    }
  | {
      readonly type: "AAAA";
      readonly name: DomainName;
      readonly value: Ipv6Address;
      readonly ttl?: number | undefined;
    }
  | {
      readonly type: "CNAME";
      readonly name: DomainName;
      readonly value: Hostname;
      readonly ttl?: number | undefined;
    }
  | {
      readonly type: "TXT";
      readonly name: DomainName;
      readonly value: string;
      readonly ttl?: number | undefined;
    };

type CreateDnsRecordOptions =
  | {
      readonly type: "A";
      readonly name: string;
      readonly value: string;
      readonly ttl?: number | undefined;
    }
  | {
      readonly type: "AAAA";
      readonly name: string;
      readonly value: string;
      readonly ttl?: number | undefined;
    }
  | {
      readonly type: "CNAME";
      readonly name: string;
      readonly value: string;
      readonly ttl?: number | undefined;
    }
  | {
      readonly type: "TXT";
      readonly name: string;
      readonly value: string;
      readonly ttl?: number | undefined;
    };

function createInvalidDnsRecordError(options: { reason: string }): ConnectError {
  return new ConnectError("INVALID_DNS_RECORD", options.reason);
}

function assertValidTtl(options: { ttl?: number | undefined }): void {
  const { ttl } = options;
  if (ttl === undefined) {
    return;
  }

  const result = ttlSchema.safeParse(ttl);
  if (!result.success) {
    throw createInvalidDnsRecordError({ reason: `Invalid DNS record TTL: ${ttl}` });
  }
}

function normalizeIpv4Address(options: { value: string }): Ipv4Address | undefined {
  const result = ipv4AddressSchema.safeParse(options.value);
  if (!result.success) {
    return undefined;
  }

  return result.data as Ipv4Address;
}

function normalizeIpv6Address(options: { value: string }): Ipv6Address | undefined {
  const result = ipv6AddressSchema.safeParse(options.value);
  if (!result.success) {
    return undefined;
  }

  try {
    const parsed = new URL(`http://[${result.data}]/`);
    return parsed.hostname.slice(1, -1) as Ipv6Address;
  } catch {
    return undefined;
  }
}

function parseHostname(options: { value: string }): Hostname | undefined {
  const result = parseDomainName({ value: options.value });
  if (result.status === "invalid-domain") {
    return undefined;
  }

  return `${result.domain}` as Hostname;
}

function isValidHostnameLabel(options: { value: string }): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(options.value);
}

function isValidUnderscoreRecordLabel(options: { value: string }): boolean {
  return /^_[a-z0-9-]{1,62}$/.test(options.value);
}

function parseRecordName(options: { value: string }): DomainName | undefined {
  const normalized = options.value.toLowerCase().trim().replace(/\.$/, "");
  if (normalized.length < 1 || normalized.length > 253) {
    return undefined;
  }

  const labels = normalized.split(".");
  if (labels.length < 2) {
    return undefined;
  }

  const isValidRecordName = labels.every(
    (label) =>
      isValidHostnameLabel({ value: label }) ||
      isValidUnderscoreRecordLabel({ value: label }),
  );
  if (!isValidRecordName) {
    return undefined;
  }

  return normalized as DomainName;
}

function createDnsRecord(options: CreateDnsRecordOptions): DnsRecord {
  const name = parseRecordName({ value: options.name });
  if (name === undefined) {
    throw createInvalidDnsRecordError({
      reason: `Invalid DNS record name: ${options.name}`,
    });
  }

  assertValidTtl({ ttl: options.ttl });

  if (options.type === "A") {
    const ipv4Address = normalizeIpv4Address({ value: options.value });
    if (ipv4Address === undefined) {
      throw createInvalidDnsRecordError({
        reason: `Invalid A record value: ${options.value}`,
      });
    }

    return {
      type: "A",
      name,
      value: ipv4Address,
      ttl: options.ttl,
    };
  }

  if (options.type === "AAAA") {
    const ipv6Address = normalizeIpv6Address({ value: options.value });
    if (ipv6Address === undefined) {
      throw createInvalidDnsRecordError({
        reason: `Invalid AAAA record value: ${options.value}`,
      });
    }

    return {
      type: "AAAA",
      name,
      value: ipv6Address,
      ttl: options.ttl,
    };
  }

  if (options.type === "CNAME") {
    const hostname = parseHostname({ value: options.value });
    if (hostname === undefined) {
      throw createInvalidDnsRecordError({
        reason: `Invalid CNAME record value: ${options.value}`,
      });
    }

    return {
      type: "CNAME",
      name,
      value: hostname,
      ttl: options.ttl,
    };
  }

  return {
    type: "TXT",
    name,
    value: options.value,
    ttl: options.ttl,
  };
}

export { createDnsRecord, normalizeIpv6Address };
export type { DnsRecord, DnsRecordType, Hostname, Ipv4Address, Ipv6Address };
