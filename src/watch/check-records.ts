import { type ConnectError } from '../connect-error';
import { normalizeDnsHostname, normalizeTxtValue } from '../dns-normalize';
import { type DnsQueryResult } from '../dns-transport';
import { normalizeIpv6Address, type DnsRecord } from '../dns-record';

type RecordCheckStatus = 'found' | 'not-found' | 'error';

type RecordCheck = {
  readonly record: DnsRecord;
  readonly resolver: string;
  readonly status: RecordCheckStatus;
  readonly actualValues: readonly string[];
};

type RecordCheckResult = {
  readonly check: RecordCheck;
  readonly error?: ConnectError;
};

function normalizeRecordValue(options: {
  record: DnsRecord;
  value: string;
}): string {
  if (options.record.type === 'CNAME') {
    return normalizeDnsHostname({ value: options.value });
  }

  if (options.record.type === 'TXT') {
    return normalizeTxtValue({ value: options.value });
  }

  if (options.record.type === 'AAAA') {
    return (
      normalizeIpv6Address({ value: options.value }) ??
      options.value.toLowerCase()
    );
  }

  return options.value;
}

function createRecordCheck(options: {
  record: DnsRecord;
  resolver: string;
  result: DnsQueryResult;
}): RecordCheckResult {
  if (options.result.status === 'error') {
    return {
      check: {
        record: options.record,
        resolver: options.resolver,
        status: 'error',
        actualValues: [],
      },
      error: options.result.error,
    };
  }

  const actualValues = options.result.answers.map((answer) =>
    normalizeRecordValue({ record: options.record, value: answer.data }),
  );
  const expectedValue = normalizeRecordValue({
    record: options.record,
    value: options.record.value,
  });

  return {
    check: {
      record: options.record,
      resolver: options.resolver,
      status: actualValues.includes(expectedValue) ? 'found' : 'not-found',
      actualValues,
    },
  };
}

function evaluateRecordChecks(options: {
  expected: readonly DnsRecord[];
  expectedResultCount: number;
  results: readonly RecordCheck[];
}): 'propagated' | 'partially-propagated' | 'pending' | 'error' {
  if (options.expected.length === 0) {
    return 'propagated';
  }

  const nonErrorResults = options.results.filter(
    (result) => result.status !== 'error',
  );
  if (nonErrorResults.length === 0) {
    return 'error';
  }

  const foundResults = options.results.filter(
    (result) => result.status === 'found',
  );
  const allExpectedRecordsMatched = options.expected.every((expectedRecord) =>
    foundResults.some(
      (result) =>
        result.record.type === expectedRecord.type &&
        result.record.name === expectedRecord.name &&
        result.record.value === expectedRecord.value,
    ),
  );
  if (
    options.results.length === options.expectedResultCount &&
    foundResults.length === nonErrorResults.length &&
    allExpectedRecordsMatched
  ) {
    return 'propagated';
  }

  if (foundResults.length > 0) {
    return 'partially-propagated';
  }

  return 'pending';
}

export { createRecordCheck, evaluateRecordChecks };
export type { RecordCheck, RecordCheckResult, RecordCheckStatus };
