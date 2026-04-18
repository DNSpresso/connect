import { ConnectError } from "../connect-error";
import { normalizeDnsHostname } from "../dns-normalize";
import { createDohTransport, type DnsQueryTransport } from "../dns-transport";
import { assertDomainName } from "../domain-name";
import { resolveProviderMatches, type NameserverMatch } from "../providers/provider-match";
import { type ProviderDefinition, type ProviderId } from "../providers/provider-registry";

type DetectProviderMethod = "nameserver-pattern" | "domain-connect";
type DetectProviderConfidence = "high" | "medium" | "low";

type DetectProviderEvidence = {
  readonly nameservers: readonly string[];
  readonly matches: readonly NameserverMatch[];
};

type DetectProviderResult =
  | {
      readonly status: "detected";
      readonly providerId: ProviderId;
      readonly provider: ProviderDefinition;
      readonly nameservers: readonly string[];
      readonly detectionMethod: DetectProviderMethod;
      readonly confidence: DetectProviderConfidence;
      readonly evidence: DetectProviderEvidence;
    }
  | {
      readonly status: "unknown-provider";
      readonly nameservers: readonly string[];
    }
  | {
      readonly status: "lookup-failed";
      readonly error: ConnectError;
    };

function getDetectionConfidence(options: {
  nameservers: readonly string[];
  providerId: ProviderId;
  matches: readonly NameserverMatch[];
}): DetectProviderConfidence {
  const uniqueNameservers = [...new Set(options.nameservers)];
  const hasConflictingProviderMatches = options.matches.some(
    (match) => match.providerId !== options.providerId,
  );

  const everyNameserverMatchesOnlyDetectedProvider = uniqueNameservers.every((nameserver) => {
    const nameserverMatches = options.matches.filter((match) => match.nameserver === nameserver);
    return (
      nameserverMatches.length > 0 &&
      nameserverMatches.every((match) => match.providerId === options.providerId)
    );
  });

  if (
    uniqueNameservers.length > 1 &&
    everyNameserverMatchesOnlyDetectedProvider &&
    !hasConflictingProviderMatches
  ) {
    return "high";
  }

  if (!hasConflictingProviderMatches) {
    return "medium";
  }

  return "low";
}

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
  const resolvedProviderMatches = resolveProviderMatches({ nameservers });

  if (resolvedProviderMatches === undefined) {
    return {
      status: "unknown-provider",
      nameservers,
    };
  }

  return {
    status: "detected",
    providerId: resolvedProviderMatches.primaryMatch.providerId,
    provider: resolvedProviderMatches.primaryMatch.provider,
    nameservers,
    detectionMethod: "nameserver-pattern",
    confidence: getDetectionConfidence({
      nameservers,
      providerId: resolvedProviderMatches.primaryMatch.providerId,
      matches: resolvedProviderMatches.nameserverMatches,
    }),
    evidence: {
      nameservers,
      matches: resolvedProviderMatches.nameserverMatches,
    },
  };
}

export { detectProvider };
export type {
  DetectProviderConfidence,
  DetectProviderEvidence,
  DetectProviderMethod,
  DetectProviderResult,
};
