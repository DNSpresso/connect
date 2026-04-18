import { ConnectError } from "../connect-error";
import { createDohTransport, type DnsQueryTransport } from "../dns-transport";
import { type DnsRecord } from "../dns-record";
import { assertDomainName } from "../domain-name";
import { createRecordCheck, evaluateRecordChecks, type RecordCheck } from "./check-records";

const DEFAULT_RESOLVERS = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
] as const;
const DEFAULT_INTERVAL = 5_000;
const DEFAULT_TIMEOUT = 300_000;

type PropagationCheck = RecordCheck;

type WatchPropagationResult =
  | {
      readonly status: "propagated";
      readonly checks: readonly PropagationCheck[];
      readonly elapsed: number;
    }
  | {
      readonly status: "partially-propagated";
      readonly checks: readonly PropagationCheck[];
      readonly elapsed: number;
    }
  | {
      readonly status: "pending";
      readonly checks: readonly PropagationCheck[];
      readonly elapsed: number;
    }
  | {
      readonly status: "timed-out";
      readonly checks: readonly PropagationCheck[];
      readonly elapsed: number;
    }
  | {
      readonly status: "error";
      readonly error: ConnectError;
      readonly checks: readonly PropagationCheck[];
      readonly elapsed: number;
    };

type CompletedPassCheck = {
  readonly check: PropagationCheck;
  readonly error?: ConnectError | undefined;
};

type PollPass = {
  readonly checks: readonly PropagationCheck[];
  readonly error?: ConnectError | undefined;
};

function isAborted(options: { signal: AbortSignal | undefined }): boolean {
  return options.signal?.aborted ?? false;
}

async function waitForInterval(options: {
  interval: number;
  signal?: AbortSignal;
}): Promise<"completed" | "aborted"> {
  if (isAborted({ signal: options.signal })) {
    return "aborted";
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve("completed");
    }, options.interval);

    const onAbort = () => {
      clearTimeout(timeoutId);
      cleanup();
      resolve("aborted");
    };

    const cleanup = () => {
      options.signal?.removeEventListener("abort", onAbort);
    };

    options.signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function runPollPass(options: {
  records: readonly DnsRecord[];
  resolvers: readonly string[];
  transport: DnsQueryTransport;
  signal?: AbortSignal;
}): Promise<PollPass | undefined> {
  const completedChecks = await Promise.all(
    options.records.flatMap((record) =>
      options.resolvers.map(async (resolver): Promise<CompletedPassCheck | undefined> => {
        if (isAborted({ signal: options.signal })) {
          return undefined;
        }

        const query: Parameters<DnsQueryTransport>[0] = {
          name: record.name,
          type: record.type,
          resolver,
        };
        if (options.signal !== undefined) {
          query.signal = options.signal;
        }

        const result = await options.transport(query);
        if (isAborted({ signal: options.signal })) {
          return undefined;
        }

        const recordCheck = createRecordCheck({ record, resolver, result });
        return {
          check: recordCheck.check,
          error: recordCheck.error,
        };
      }),
    ),
  );

  if (isAborted({ signal: options.signal })) {
    return undefined;
  }

  const checks = completedChecks
    .filter((completedCheck) => completedCheck !== undefined)
    .map((completedCheck) => completedCheck.check);
  const firstError = completedChecks.find(
    (completedCheck) => completedCheck?.error !== undefined,
  )?.error;

  return {
    checks,
    error: firstError,
  };
}

async function* watchPropagation(options: {
  domain: string;
  records: readonly DnsRecord[];
  interval?: number;
  timeout?: number;
  resolvers?: readonly string[];
  transport?: DnsQueryTransport;
  signal?: AbortSignal;
}): AsyncGenerator<WatchPropagationResult> {
  assertDomainName({ value: options.domain });
  const interval = options.interval ?? DEFAULT_INTERVAL;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const resolvers = options.resolvers ?? DEFAULT_RESOLVERS;
  const transport = options.transport ?? createDohTransport();
  const startedAt = Date.now();

  while (!isAborted({ signal: options.signal })) {
    const runPollPassOptions: {
      records: readonly DnsRecord[];
      resolvers: readonly string[];
      transport: DnsQueryTransport;
      signal?: AbortSignal;
    } = {
      records: options.records,
      resolvers,
      transport,
    };
    if (options.signal !== undefined) {
      runPollPassOptions.signal = options.signal;
    }

    const pollPass = await runPollPass(runPollPassOptions);
    if (pollPass === undefined || isAborted({ signal: options.signal })) {
      return;
    }

    const elapsed = Date.now() - startedAt;
    const aggregateStatus = evaluateRecordChecks({
      expected: options.records,
      results: pollPass.checks,
    });

    if (aggregateStatus === "error") {
      if (elapsed >= timeout) {
        yield {
          status: "timed-out",
          checks: pollPass.checks,
          elapsed,
        };
        return;
      }

      yield {
        status: "error",
        error: pollPass.error ?? new ConnectError("DNS_LOOKUP_FAILED", "DNS lookup failed"),
        checks: pollPass.checks,
        elapsed,
      };
    }

    if (aggregateStatus !== "error") {
      yield {
        status: aggregateStatus,
        checks: pollPass.checks,
        elapsed,
      };
    }

    if (aggregateStatus === "propagated") {
      return;
    }

    if (elapsed >= timeout) {
      yield {
        status: "timed-out",
        checks: pollPass.checks,
        elapsed,
      };
      return;
    }

    const waitForIntervalOptions: {
      interval: number;
      signal?: AbortSignal;
    } = {
      interval,
    };
    if (options.signal !== undefined) {
      waitForIntervalOptions.signal = options.signal;
    }

    const waitStatus = await waitForInterval(waitForIntervalOptions);
    if (waitStatus === "aborted") {
      return;
    }
  }
}

export { watchPropagation };
export type { PropagationCheck, WatchPropagationResult };
