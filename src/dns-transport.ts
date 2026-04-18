import { ConnectError } from './connect-error';
import { type DnsRecordType } from './dns-record';

type DnsQueryType = DnsRecordType | 'NS';

type DnsAnswer = {
  readonly name: string;
  readonly type: number;
  readonly ttl: number;
  readonly data: string;
};

type DnsQueryResult =
  | { readonly status: 'success'; readonly answers: readonly DnsAnswer[] }
  | { readonly status: 'error'; readonly error: ConnectError };

type DnsQueryTransport = (options: {
  name: string;
  type: DnsQueryType;
  resolver?: string;
  signal?: AbortSignal;
}) => Promise<DnsQueryResult>;

type DohAnswer = {
  readonly name: string;
  readonly type: number;
  readonly TTL: number;
  readonly data: string;
};

type DohJsonResponse = {
  readonly Status: number;
  readonly Answer?: readonly DohAnswer[];
};

function mapAnswers(options: {
  response: DohJsonResponse;
}): readonly DnsAnswer[] {
  if (options.response.Status !== 0) {
    return [];
  }

  return (options.response.Answer ?? []).map((answer) => ({
    name: answer.name,
    type: answer.type,
    ttl: answer.TTL,
    data: answer.data,
  }));
}

function createDohTransport(options?: {
  defaultResolver?: string;
}): DnsQueryTransport {
  const defaultResolver =
    options?.defaultResolver ?? 'https://cloudflare-dns.com/dns-query';

  return async ({ name, type, resolver, signal }) => {
    const url = new URL(resolver ?? defaultResolver);
    url.searchParams.set('name', name);
    url.searchParams.set('type', type);

    try {
      const requestInit: RequestInit = {
        headers: { Accept: 'application/dns-json' },
      };
      if (signal !== undefined) {
        requestInit.signal = signal;
      }

      const response = await fetch(url, requestInit);
      if (!response.ok) {
        return {
          status: 'error',
          error: new ConnectError(
            'DNS_LOOKUP_FAILED',
            `DoH ${response.status}`,
          ),
        };
      }

      const json = (await response.json()) as DohJsonResponse;
      return { status: 'success', answers: mapAnswers({ response: json }) };
    } catch (error) {
      return {
        status: 'error',
        error: new ConnectError('DNS_LOOKUP_FAILED', 'DNS query failed', {
          cause: error,
        }),
      };
    }
  };
}

export { createDohTransport };
export type { DnsAnswer, DnsQueryResult, DnsQueryTransport, DnsQueryType };
