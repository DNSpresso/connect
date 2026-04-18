import { normalizeDnsHostname } from "../dns-normalize";
import { PROVIDER_REGISTRY, type ProviderDefinition, type ProviderId } from "./provider-registry";

const globRegexCache = new Map<string, RegExp>();

type ProviderMatch = {
  readonly providerId: ProviderId;
  readonly provider: ProviderDefinition;
  readonly matchedPattern: string;
  readonly matchedNameserver: string;
};

type NameserverMatch = {
  readonly nameserver: string;
  readonly providerId: ProviderId;
  readonly matchedPattern: string;
};

type ResolvedProviderMatches = {
  readonly primaryMatch: ProviderMatch;
  readonly nameserverMatches: readonly NameserverMatch[];
};

function toNameserverMatch(options: { match: ProviderMatch }): NameserverMatch {
  return {
    nameserver: options.match.matchedNameserver,
    providerId: options.match.providerId,
    matchedPattern: options.match.matchedPattern,
  };
}

function getGlobRegex(options: { pattern: string }): RegExp {
  const cached = globRegexCache.get(options.pattern);
  if (cached !== undefined) {
    return cached;
  }

  let pattern = "^";
  for (const character of options.pattern) {
    if (character === "*") {
      pattern += "[^.]*";
      continue;
    }

    if (/[$()*+.?[\\\]^{|}]/.test(character)) {
      pattern += `\\${character}`;
      continue;
    }

    pattern += character;
  }
  pattern += "$";

  const regex = new RegExp(pattern);
  globRegexCache.set(options.pattern, regex);
  return regex;
}

function collectProviderMatches(options: {
  nameservers: readonly string[];
}): readonly ProviderMatch[] {
  const normalizedNameservers = options.nameservers.map((nameserver) =>
    normalizeDnsHostname({ value: nameserver }),
  );
  const providers = Object.entries(PROVIDER_REGISTRY) as readonly [
    ProviderId,
    ProviderDefinition,
  ][];

  const matches: ProviderMatch[] = [];

  for (const nameserver of normalizedNameservers) {
    for (const [providerId, provider] of providers) {
      for (const pattern of provider.nameserverPatterns) {
        if (getGlobRegex({ pattern }).test(nameserver)) {
          matches.push({
            providerId,
            provider,
            matchedPattern: pattern,
            matchedNameserver: nameserver,
          });
        }
      }
    }
  }

  return matches;
}

function resolveProviderMatches(options: {
  nameservers: readonly string[];
}): ResolvedProviderMatches | undefined {
  const providerMatches = collectProviderMatches(options);
  const primaryMatch = providerMatches[0];

  if (primaryMatch === undefined) {
    return undefined;
  }

  return {
    primaryMatch,
    nameserverMatches: providerMatches.map((match) => toNameserverMatch({ match })),
  };
}

function matchProvider(options: { nameservers: readonly string[] }): ProviderMatch | undefined {
  return collectProviderMatches(options)[0];
}

export { matchProvider, resolveProviderMatches };
export type { NameserverMatch, ProviderMatch, ResolvedProviderMatches };
