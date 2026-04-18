import { describe, expect, it, vi } from "vitest";

import { ConnectError } from "../connect-error";
import { type DnsQueryResult, type DnsQueryTransport } from "../dns-transport";
import { createDnsRecord } from "../dns-record";
import { watchPropagation } from "./watch-propagation";

const domain = "example.com";
const txtRecord = createDnsRecord({
  type: "TXT",
  name: domain,
  value: "redirectry-verify=abc123",
});

function createSequenceTransport(options: {
  responses: readonly DnsQueryResult[];
}): DnsQueryTransport {
  let index = 0;

  return async () => {
    const response = options.responses[index] ?? options.responses.at(-1);
    index += 1;

    if (response === undefined) {
      throw new Error("Expected at least one mock DNS response");
    }

    return response;
  };
}

describe("watchPropagation", () => {
  it("yields propagated when all records are found immediately", async () => {
    const transport = createSequenceTransport({
      responses: [
        {
          status: "success",
          answers: [
            {
              name: "example.com",
              type: 16,
              ttl: 300,
              data: '"redirectry-verify=abc123"',
            },
          ],
        },
        {
          status: "success",
          answers: [
            {
              name: "example.com",
              type: 16,
              ttl: 300,
              data: '"redirectry-verify=abc123"',
            },
          ],
        },
      ],
    });

    const iterator = watchPropagation({
      domain,
      records: [txtRecord],
      transport,
    });
    const first = await iterator.next();
    const done = await iterator.next();

    expect(first.value).toMatchObject({ status: "propagated" });
    expect(done.done).toBe(true);
  });

  it("yields partial progress before propagation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    try {
      const transport = createSequenceTransport({
        responses: [
          {
            status: "success",
            answers: [
              {
                name: "example.com",
                type: 16,
                ttl: 300,
                data: '"redirectry-verify=abc123"',
              },
            ],
          },
          {
            status: "success",
            answers: [],
          },
          {
            status: "success",
            answers: [
              {
                name: "example.com",
                type: 16,
                ttl: 300,
                data: '"redirectry-verify=abc123"',
              },
            ],
          },
          {
            status: "success",
            answers: [
              {
                name: "example.com",
                type: 16,
                ttl: 300,
                data: '"redirectry-verify=abc123"',
              },
            ],
          },
        ],
      });

      const iterator = watchPropagation({
        domain,
        records: [txtRecord],
        transport,
        interval: 1_000,
      });

      const first = await iterator.next();
      const secondPromise = iterator.next();
      await vi.advanceTimersByTimeAsync(1_000);
      const second = await secondPromise;

      expect(first.value).toMatchObject({ status: "partially-propagated" });
      expect(second.value).toMatchObject({ status: "propagated" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("times out when records never appear", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    try {
      const transport = createSequenceTransport({
        responses: [
          { status: "success", answers: [] },
          { status: "success", answers: [] },
          { status: "success", answers: [] },
          { status: "success", answers: [] },
        ],
      });

      const iterator = watchPropagation({
        domain,
        records: [txtRecord],
        transport,
        interval: 1_000,
        timeout: 1_000,
      });

      const first = await iterator.next();
      const secondPromise = iterator.next();
      await vi.advanceTimersByTimeAsync(1_000);
      const second = await secondPromise;
      const third = await iterator.next();

      expect(first.value).toMatchObject({ status: "pending" });
      expect(second.value).toMatchObject({ status: "pending" });
      expect(third.value).toMatchObject({ status: "timed-out" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats a single resolver failure as non-fatal", async () => {
    const transport = createSequenceTransport({
      responses: [
        {
          status: "error",
          error: new ConnectError("DNS_LOOKUP_FAILED", "resolver failed"),
        },
        {
          status: "success",
          answers: [],
        },
      ],
    });

    const iterator = watchPropagation({
      domain,
      records: [txtRecord],
      transport,
      timeout: 0,
    });
    const first = await iterator.next();

    expect(first.value).toMatchObject({ status: "pending" });
  });

  it("continues polling after an all-resolver failure pass", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    try {
      const transport = createSequenceTransport({
        responses: [
          {
            status: "error",
            error: new ConnectError("DNS_LOOKUP_FAILED", "resolver 1 failed"),
          },
          {
            status: "error",
            error: new ConnectError("DNS_LOOKUP_FAILED", "resolver 2 failed"),
          },
          {
            status: "success",
            answers: [
              {
                name: "example.com",
                type: 16,
                ttl: 300,
                data: '"redirectry-verify=abc123"',
              },
            ],
          },
          {
            status: "success",
            answers: [
              {
                name: "example.com",
                type: 16,
                ttl: 300,
                data: '"redirectry-verify=abc123"',
              },
            ],
          },
        ],
      });

      const iterator = watchPropagation({
        domain,
        records: [txtRecord],
        transport,
        interval: 1_000,
      });

      const first = await iterator.next();
      const secondPromise = iterator.next();
      await vi.advanceTimersByTimeAsync(1_000);
      const second = await secondPromise;

      expect(first.value).toMatchObject({ status: "error" });
      expect(second.value).toMatchObject({ status: "propagated" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns cleanly when aborted mid-poll", async () => {
    const controller = new AbortController();
    const transport: DnsQueryTransport = ({ signal }) =>
      new Promise((resolve) => {
        signal?.addEventListener(
          "abort",
          () => {
            resolve({
              status: "error",
              error: new ConnectError("DNS_LOOKUP_FAILED", "aborted"),
            });
          },
          { once: true },
        );
      });

    const iterator = watchPropagation({
      domain,
      records: [txtRecord],
      transport,
      signal: controller.signal,
    });
    const nextPromise = iterator.next();
    controller.abort();
    const result = await nextPromise;

    expect(result.done).toBe(true);
  });

  it("matches TXT responses with quoted values", async () => {
    const transport = createSequenceTransport({
      responses: [
        {
          status: "success",
          answers: [
            {
              name: "example.com",
              type: 16,
              ttl: 300,
              data: '"redirectry-verify=" "abc123"',
            },
          ],
        },
        {
          status: "success",
          answers: [
            {
              name: "example.com",
              type: 16,
              ttl: 300,
              data: '"redirectry-verify=abc123"',
            },
          ],
        },
      ],
    });

    const iterator = watchPropagation({
      domain,
      records: [txtRecord],
      transport,
    });
    const first = await iterator.next();

    expect(first.value).toMatchObject({ status: "propagated" });
  });
});
