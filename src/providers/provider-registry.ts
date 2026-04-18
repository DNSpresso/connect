import { z } from "zod";

import rawProviderRegistry from "../data/provider-data.json";

const providerDefinitionSchema = z.object({
  name: z.string().min(1),
  nameserverPatterns: z.array(z.string().min(1)).min(1),
  dnsSettingsUrl: z.string().url().optional(),
  notes: z.array(z.string().min(1)).optional(),
});
const providerRegistrySchema = z.record(z.string(), providerDefinitionSchema);

type ProviderDefinition = {
  readonly name: string;
  readonly nameserverPatterns: readonly string[];
  readonly dnsSettingsUrl?: string | undefined;
  readonly notes?: readonly string[] | undefined;
};
type ProviderId = keyof typeof rawProviderRegistry;

type ProviderRegistry = Record<ProviderId, ProviderDefinition>;

function toReadonlyProviderDefinition(options: {
  provider: z.infer<typeof providerDefinitionSchema>;
}): ProviderDefinition {
  return Object.freeze({
    name: options.provider.name,
    nameserverPatterns: Object.freeze([...options.provider.nameserverPatterns]),
    dnsSettingsUrl: options.provider.dnsSettingsUrl,
    notes:
      options.provider.notes === undefined
        ? undefined
        : Object.freeze([...options.provider.notes]),
  });
}

const parsedProviderRegistry = providerRegistrySchema.parse(rawProviderRegistry);
const providerRegistryEntries = Object.entries(parsedProviderRegistry).map(([providerId, provider]) => [
  providerId,
  toReadonlyProviderDefinition({ provider }),
]);

const PROVIDER_REGISTRY = Object.freeze(
  Object.fromEntries(providerRegistryEntries),
) as ProviderRegistry;

export { PROVIDER_REGISTRY };
export type { ProviderDefinition, ProviderId };
