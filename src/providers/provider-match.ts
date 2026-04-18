import { normalizeDnsHostname } from "../dns-normalize";
import { PROVIDER_REGISTRY, type ProviderDefinition, type ProviderId } from "./provider-registry";

const globRegexCache = new Map<string, RegExp>();

type ProviderMatch = {
  readonly providerId: ProviderId;
  readonly provider: ProviderDefinition;
  readonly matchedPattern: string;
  readonly matchedNameserver: string;
};

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

function matchProvider(options: { nameservers: readonly string[] }): ProviderMatch | undefined {
  const normalizedNameservers = options.nameservers.map((nameserver) =>
    normalizeDnsHostname({ value: nameserver }),
  );
  const providers = Object.entries(PROVIDER_REGISTRY) as readonly [
    ProviderId,
    ProviderDefinition,
  ][];

  for (const nameserver of normalizedNameservers) {
    for (const [providerId, provider] of providers) {
      for (const pattern of provider.nameserverPatterns) {
        if (getGlobRegex({ pattern }).test(nameserver)) {
          return {
            providerId,
            provider,
            matchedPattern: pattern,
            matchedNameserver: nameserver,
          };
        }
      }
    }
  }

  return undefined;
}

export { matchProvider };
export type { ProviderMatch };
