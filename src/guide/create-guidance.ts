import { ConnectError } from "../connect-error";
import {
  type DetectProviderConfidence,
  type DetectProviderMethod,
  type DetectProviderResult,
} from "../detect/detect-provider";
import { type DnsRecord } from "../dns-record";
import { assertDomainName, type DomainName } from "../domain-name";
import {
  type HostFieldStrategy,
  type ProviderCapabilities,
  type ProviderId,
} from "../providers/provider-registry";

const DEFAULT_TTL = 300;
const DEFAULT_NOTES: readonly string[] = ["Changes may take time to propagate"];

type GuidanceMode = "manual" | "domain-connect" | "api";

type DnsRecordInstruction = {
  readonly record: DnsRecord;
  readonly hostField: string;
  readonly valueField: string;
  readonly ttlField: number;
};

type SetupGuidance = {
  readonly mode: GuidanceMode;
  readonly provider:
    | {
        readonly status: "detected";
        readonly providerId: ProviderId;
        readonly name: string;
        readonly capabilities: ProviderCapabilities;
        readonly detectionMethod: DetectProviderMethod;
        readonly confidence: DetectProviderConfidence;
      }
    | { readonly status: "unknown-provider" }
    | { readonly status: "lookup-failed"; readonly error: ConnectError };
  readonly records: readonly DnsRecordInstruction[];
  readonly links: {
    readonly dnsSettings?: string | undefined;
  };
  readonly notes: readonly string[];
};

function getHostField(options: {
  recordName: DomainName;
  domain: DomainName;
  strategy: HostFieldStrategy;
}): string {
  const isRoot = options.recordName === options.domain;

  if (isRoot) {
    switch (options.strategy) {
      case "at-symbol":
        return "@";
      case "blank":
        return "";
      case "full-domain":
        return options.domain;
      default: {
        const _exhaustive: never = options.strategy;
        return _exhaustive;
      }
    }
  }

  if (options.strategy === "full-domain") {
    return options.recordName;
  }

  const suffix = `.${options.domain}`;
  if (options.recordName.endsWith(suffix)) {
    return options.recordName.slice(0, -suffix.length);
  }

  return options.recordName;
}

function createRecordInstruction(options: {
  record: DnsRecord;
  domain: DomainName;
  strategy: HostFieldStrategy;
}): DnsRecordInstruction {
  return {
    record: options.record,
    hostField: getHostField({
      recordName: options.record.name,
      domain: options.domain,
      strategy: options.strategy,
    }),
    valueField: options.record.value,
    ttlField: options.record.ttl ?? DEFAULT_TTL,
  };
}

function createSetupGuidance(options: {
  detection: DetectProviderResult;
  records: readonly DnsRecord[];
  domain: string;
}): SetupGuidance {
  const domain = assertDomainName({ value: options.domain });
  const strategy: HostFieldStrategy =
    options.detection.status === "detected"
      ? options.detection.provider.hostFieldStrategy
      : "at-symbol";
  const records = options.records.map((record) =>
    createRecordInstruction({ record, domain, strategy }),
  );
  const notes = [...DEFAULT_NOTES];

  if (options.detection.status === "detected") {
    if (options.detection.provider.notes !== undefined) {
      notes.push(...options.detection.provider.notes);
    }

    return {
      mode: "manual",
      provider: {
        status: "detected",
        providerId: options.detection.providerId,
        name: options.detection.provider.name,
        capabilities: options.detection.provider.capabilities,
        detectionMethod: options.detection.detectionMethod,
        confidence: options.detection.confidence,
      },
      records,
      links: {
        dnsSettings: options.detection.provider.dnsSettings?.baseUrl,
      },
      notes,
    };
  }

  if (options.detection.status === "lookup-failed") {
    return {
      mode: "manual",
      provider: {
        status: "lookup-failed",
        error: options.detection.error,
      },
      records,
      links: {},
      notes,
    };
  }

  return {
    mode: "manual",
    provider: { status: "unknown-provider" },
    records,
    links: {},
    notes,
  };
}

export { createSetupGuidance };
export type { DnsRecordInstruction, GuidanceMode, SetupGuidance };
