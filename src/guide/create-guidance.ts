import { ConnectError } from "../connect-error";
import { type DetectProviderResult } from "../detect/detect-provider";
import { type DnsRecord } from "../dns-record";
import { assertDomainName, type DomainName } from "../domain-name";
import { type ProviderId } from "../providers/provider-registry";

const DEFAULT_TTL = 300;
const DEFAULT_NOTES: readonly string[] = ["Changes may take time to propagate"];

type DnsRecordInstruction = {
  readonly record: DnsRecord;
  readonly hostField: string;
  readonly valueField: string;
  readonly ttlField: number;
};

type SetupGuidance = {
  readonly provider:
    | {
        readonly status: "detected";
        readonly providerId: ProviderId;
        readonly name: string;
      }
    | { readonly status: "unknown-provider" }
    | { readonly status: "lookup-failed"; readonly error: ConnectError };
  readonly records: readonly DnsRecordInstruction[];
  readonly links: {
    readonly dnsSettings?: string | undefined;
  };
  readonly notes: readonly string[];
};

function getHostField(options: { recordName: DomainName; domain: DomainName }): string {
  if (options.recordName === options.domain) {
    return "@";
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
}): DnsRecordInstruction {
  return {
    record: options.record,
    hostField: getHostField({ recordName: options.record.name, domain: options.domain }),
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
  const records = options.records.map((record) =>
    createRecordInstruction({ record, domain }),
  );
  const notes = [...DEFAULT_NOTES];

  if (options.detection.status === "detected") {
    if (options.detection.provider.notes !== undefined) {
      notes.push(...options.detection.provider.notes);
    }

    return {
      provider: {
        status: "detected",
        providerId: options.detection.providerId,
        name: options.detection.provider.name,
      },
      records,
      links: {
        dnsSettings: options.detection.provider.dnsSettingsUrl,
      },
      notes,
    };
  }

  if (options.detection.status === "lookup-failed") {
    return {
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
    provider: { status: "unknown-provider" },
    records,
    links: {},
    notes,
  };
}

export { createSetupGuidance };
export type { DnsRecordInstruction, SetupGuidance };
