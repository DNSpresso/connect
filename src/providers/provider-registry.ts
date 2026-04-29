import { z } from "zod";

import rawProviderRegistry from "../data/provider-data.json";

const PROVIDER_CAPABILITY_SUPPORT = ["supported", "unsupported", "unknown"] as const;
const providerCapabilitySupportSchema = z.enum(PROVIDER_CAPABILITY_SUPPORT);
const PROVIDER_DEEP_LINK_STRATEGIES = ["none", "domain-path", "zone-id"] as const;
const providerDeepLinkStrategySchema = z.enum(PROVIDER_DEEP_LINK_STRATEGIES);
const HOST_FIELD_STRATEGIES = ["at-symbol", "blank", "full-domain"] as const;
const hostFieldStrategySchema = z.enum(HOST_FIELD_STRATEGIES);
const providerDnsSettingsSchema = z.object({
  baseUrl: z.url(),
  deepLinkStrategy: providerDeepLinkStrategySchema,
});
const providerCapabilitiesSchema = z.object({
  manual: z.literal(true),
  domainConnect: providerCapabilitySupportSchema,
  providerApi: providerCapabilitySupportSchema,
});
const providerOAuthConfigSchema = z.object({
  authorizationUrl: z.url(),
  tokenUrl: z.url(),
  defaultScopes: z.array(z.string().min(1)),
  supportsPkce: z.boolean(),
});

const providerDefinitionSchema = z.object({
  name: z.string().min(1),
  nameserverPatterns: z.array(z.string().min(1)).min(1),
  dnsSettings: providerDnsSettingsSchema.optional(),
  capabilities: providerCapabilitiesSchema,
  hostFieldStrategy: hostFieldStrategySchema,
  oauth: providerOAuthConfigSchema.optional(),
  notes: z.array(z.string().min(1)).optional(),
});
const providerRegistrySchema = z.record(z.string(), providerDefinitionSchema);

type ProviderCapabilitySupport = (typeof PROVIDER_CAPABILITY_SUPPORT)[number];
type ProviderDeepLinkStrategy = (typeof PROVIDER_DEEP_LINK_STRATEGIES)[number];
type HostFieldStrategy = (typeof HOST_FIELD_STRATEGIES)[number];

type ProviderCapabilities = {
  readonly manual: true;
  readonly domainConnect: ProviderCapabilitySupport;
  readonly providerApi: ProviderCapabilitySupport;
};

type ProviderDnsSettings = {
  readonly baseUrl: string;
  readonly deepLinkStrategy: ProviderDeepLinkStrategy;
};

type ProviderOAuthConfig = {
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly defaultScopes: readonly string[];
  readonly supportsPkce: boolean;
};

type ProviderDefinition = {
  readonly name: string;
  readonly nameserverPatterns: readonly string[];
  readonly dnsSettings?: ProviderDnsSettings | undefined;
  readonly capabilities: ProviderCapabilities;
  readonly hostFieldStrategy: HostFieldStrategy;
  readonly oauth?: ProviderOAuthConfig | undefined;
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
    hostFieldStrategy: options.provider.hostFieldStrategy,
    oauth:
      options.provider.oauth === undefined
        ? undefined
        : Object.freeze({
            authorizationUrl: options.provider.oauth.authorizationUrl,
            tokenUrl: options.provider.oauth.tokenUrl,
            defaultScopes: Object.freeze([...options.provider.oauth.defaultScopes]),
            supportsPkce: options.provider.oauth.supportsPkce,
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

export { HOST_FIELD_STRATEGIES, PROVIDER_REGISTRY };
export type {
  HostFieldStrategy,
  ProviderCapabilities,
  ProviderCapabilitySupport,
  ProviderDeepLinkStrategy,
  ProviderDefinition,
  ProviderDnsSettings,
  ProviderId,
  ProviderOAuthConfig,
};
