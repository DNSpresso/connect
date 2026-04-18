import { z } from "zod";

import rawProviderRegistry from "../data/provider-data.json";

const PROVIDER_CAPABILITY_SUPPORT = ["supported", "unsupported", "unknown"] as const;
const providerCapabilitySupportSchema = z.enum(PROVIDER_CAPABILITY_SUPPORT);
const PROVIDER_DEEP_LINK_STRATEGIES = ["none", "domain-path", "zone-id"] as const;
const providerDeepLinkStrategySchema = z.enum(PROVIDER_DEEP_LINK_STRATEGIES);
const providerDnsSettingsSchema = z.object({
  baseUrl: z.string().url(),
  deepLinkStrategy: providerDeepLinkStrategySchema,
});
const providerCapabilitiesSchema = z.object({
  manual: z.literal(true),
  domainConnect: providerCapabilitySupportSchema,
  providerApi: providerCapabilitySupportSchema,
});
const providerDefinitionSchema = z.object({
  name: z.string().min(1),
  nameserverPatterns: z.array(z.string().min(1)).min(1),
  dnsSettings: providerDnsSettingsSchema.optional(),
  capabilities: providerCapabilitiesSchema,
  notes: z.array(z.string().min(1)).optional(),
});
const providerRegistrySchema = z.record(z.string(), providerDefinitionSchema);

type ProviderCapabilitySupport = (typeof PROVIDER_CAPABILITY_SUPPORT)[number];
type ProviderDeepLinkStrategy = (typeof PROVIDER_DEEP_LINK_STRATEGIES)[number];

type ProviderCapabilities = {
  readonly manual: true;
  readonly domainConnect: ProviderCapabilitySupport;
  readonly providerApi: ProviderCapabilitySupport;
};

type ProviderDnsSettings = {
  readonly baseUrl: string;
  readonly deepLinkStrategy: ProviderDeepLinkStrategy;
};

type ProviderDefinition = {
  readonly name: string;
  readonly nameserverPatterns: readonly string[];
  readonly dnsSettings?: ProviderDnsSettings | undefined;
  readonly capabilities: ProviderCapabilities;
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
    dnsSettings:
      options.provider.dnsSettings === undefined
        ? undefined
        : Object.freeze({
            baseUrl: options.provider.dnsSettings.baseUrl,
            deepLinkStrategy: options.provider.dnsSettings.deepLinkStrategy,
          }),
    capabilities: Object.freeze({
      manual: options.provider.capabilities.manual,
      domainConnect: options.provider.capabilities.domainConnect,
      providerApi: options.provider.capabilities.providerApi,
    }),
    notes:
      options.provider.notes === undefined ? undefined : Object.freeze([...options.provider.notes]),
  });
}

const parsedProviderRegistry = providerRegistrySchema.parse(rawProviderRegistry);
const providerRegistryEntries = Object.entries(parsedProviderRegistry).map(
  ([providerId, provider]) => [providerId, toReadonlyProviderDefinition({ provider })],
);

const PROVIDER_REGISTRY = Object.freeze(
  Object.fromEntries(providerRegistryEntries),
) as ProviderRegistry;

export { PROVIDER_REGISTRY };
export type {
  ProviderCapabilities,
  ProviderCapabilitySupport,
  ProviderDeepLinkStrategy,
  ProviderDefinition,
  ProviderDnsSettings,
  ProviderId,
};
