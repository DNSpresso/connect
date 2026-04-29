# @dnspresso/connect

The open source toolkit for DNS onboarding.

It helps applications:

- detect the likely DNS provider from a domain's nameservers
- generate structured guidance for the DNS records a user needs to add
- watch propagation with typed progress states

The SDK is designed for products that need users to complete manual DNS setup for things like custom domains, verification records, and other DNS-based configuration.

### Included providers

- Cloudflare
- GoDaddy
- Namecheap
- Amazon Route 53
- Porkbun
- OVHcloud
- Hetzner
- IONOS
- Squarespace Domains
- Google Cloud DNS
- Gandi
- DigitalOcean

Provider data lives in `src/data/provider-data.json`

## Installation

```bash
pnpm add @dnspresso/connect
```

## Quick start

```ts
import {
  createDnsRecord,
  createSetupGuidance,
  detectProvider,
  watchPropagation,
} from "@dnspresso/connect";

const domain = "example.com";
const detection = await detectProvider({ domain });

const records = [
  createDnsRecord({
    type: "CNAME",
    name: "www.example.com",
    value: "app.example.com",
  }),
  createDnsRecord({
    type: "TXT",
    name: domain,
    value: "verification=abc123",
  }),
];

const guidance = createSetupGuidance({
  detection,
  records,
  domain,
});

if (detection.status === "detected") {
  // Use detection.provider, detection.confidence, and detection.evidence
  // to drive your onboarding UI.
}

if (guidance.mode === "manual") {
  // Render guidance.records, guidance.links, and guidance.notes.
}

for await (const result of watchPropagation({ domain, records })) {
  if (result.status === "propagated") {
    break;
  }

  if (result.status === "timed-out") {
    break;
  }
}
```

## API

### `detectProvider`

Resolves NS records for a domain and matches them against the provider registry.

```ts
const result = await detectProvider({ domain: "example.com" });
```

Returns one of:

- `detected`
- `unknown-provider`
- `lookup-failed`

Detected results now include structured detection metadata:

- `detectionMethod`
- `confidence`
- `evidence.nameservers`
- `evidence.matches`

### `createDnsRecord`

Validates and normalizes a required DNS record.

Supported record types:

- `A`
- `AAAA`
- `CNAME`
- `TXT`

```ts
const record = createDnsRecord({
  type: "CNAME",
  name: "www.example.com",
  value: "target.example.net",
});
```

### `createSetupGuidance`

Builds structured, UI-ready guidance from the provider result and required records.

```ts
const guidance = createSetupGuidance({
  detection,
  records,
  domain: "example.com",
});
```

The output includes:

- `mode` for the guidance flow
- detected provider metadata when available
- provider capabilities for future setup paths
- detection metadata (`detectionMethod` and `confidence`) when a provider was detected
- a DNS settings link when known
- normalized record instructions
- generic and provider-specific notes

### `watchPropagation`

Polls public DNS-over-HTTPS resolvers and yields typed progress updates.

Possible states:

- `pending`
- `partially-propagated`
- `propagated`
- `timed-out`
- `error`

```ts
for await (const result of watchPropagation({ domain: "example.com", records })) {
  console.log(result.status);
}
```

### `parseDomainName`

Optional helper for non-throwing domain validation at the UI boundary.

```ts
const parsed = parseDomainName({ value: "Example.com" });
```

The main SDK functions validate their string inputs internally, so this helper is not required for the normal flow.

## OAuth handshake foundation

The SDK exposes a typed, headless OAuth 2.0 handshake foundation: build a provider authorization URL, then exchange the returned authorization code for tokens. The transport is injectable. Tokens are returned to the caller; the SDK keeps no state. No specific provider's OAuth metadata ships in this release — `provider.oauth` is `undefined` for every entry. Provider integrations land in subsequent versions.

```ts
import { createProviderOAuthAuthorizationUrl, exchangeProviderOAuthCode } from "@dnspresso/connect";

// This currently returns provider-not-configured for cloudflare
// until the follow-up provider metadata plan lands.
const authUrl = createProviderOAuthAuthorizationUrl({
  providerId: "cloudflare",
  clientId: "your-client-id",
  redirectUri: "https://app.example.com/callback",
  state: "random-state",
});

if (authUrl.status === "success") {
  // Redirect the user to authUrl.url
}
```
