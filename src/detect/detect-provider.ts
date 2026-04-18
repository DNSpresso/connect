import { ConnectError } from "../connect-error";
import { normalizeDnsHostname } from "../dns-normalize";
import { createDohTransport, type DnsQueryTransport } from "../dns-transport";
import { assertDomainName } from "../domain-name";
import { matchProvider } from "../providers/provider-match";
import { type ProviderDefinition, type ProviderId } from "../providers/provider-registry";

type DetectProviderResult =
  | {
      readonly status: "detected";
      readonly providerId: ProviderId;
      readonly provider: ProviderDefinition;
      readonly nameservers: readonly string[];
      readonly matchedPattern: string;
    }
  | {
      readonly status: "unknown-provider";
      readonly nameservers: readonly string[];
    }
  | {
      readonly status: "lookup-failed";
      readonly error: ConnectError;
    };

async function detectProvider(options: {
  domain: string;
  transport?: DnsQueryTransport;
  signal?: AbortSignal;
}): Promise<DetectProviderResult> {
  const domain = assertDomainName({ value: options.domain });
  const transport = options.transport ?? createDohTransport();
  const query: Parameters<DnsQueryTransport>[0] = {
    name: domain,
    type: "NS",
  };
  if (options.signal !== undefined) {
    query.signal = options.signal;
  }

  const lookupResult = await transport(query);

  if (lookupResult.status === "error") {
    return {
      status: "lookup-failed",
      error: lookupResult.error,
    };
  }

  const nameservers = lookupResult.answers.map((answer) =>
    normalizeDnsHostname({ value: answer.data }),
  );
  const match = matchProvider({ nameservers });

  if (match === undefined) {
    return {
      status: "unknown-provider",
      nameservers,
    };
  }

  return {
    status: "detected",
    providerId: match.providerId,
    provider: match.provider,
    nameservers,
    matchedPattern: match.matchedPattern,
  };
}

export { detectProvider };
export type { DetectProviderResult };
