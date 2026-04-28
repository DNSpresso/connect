export { ConnectError } from "./connect-error";
export { createDnsRecord } from "./dns-record";
export { createDohTransport } from "./dns-transport";
export { parseDomainName } from "./domain-name";
export { detectProvider } from "./detect/detect-provider";
export { createSetupGuidance } from "./guide/create-guidance";
export { watchPropagation } from "./watch/watch-propagation";

export type { ConnectErrorCode } from "./connect-error";
export type { DnsRecord, DnsRecordType, Hostname, Ipv4Address, Ipv6Address } from "./dns-record";
export type { DnsAnswer, DnsQueryResult, DnsQueryTransport, DnsQueryType } from "./dns-transport";
export type { DomainName, ParseDomainNameResult } from "./domain-name";
export type {
  DetectProviderConfidence,
  DetectProviderEvidence,
  DetectProviderMethod,
  DetectProviderResult,
} from "./detect/detect-provider";
export type { DnsRecordInstruction, GuidanceMode, SetupGuidance } from "./guide/create-guidance";
export type {
  ProviderCapabilities,
  ProviderCapabilitySupport,
  ProviderDeepLinkStrategy,
  ProviderDefinition,
  ProviderDnsSettings,
  ProviderId,
} from "./providers/provider-registry";
export type { NameserverMatch, ProviderMatch } from "./providers/provider-match";
export type { PropagationCheck, WatchPropagationResult } from "./watch/watch-propagation";
