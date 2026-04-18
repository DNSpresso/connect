import { expect, it } from "vitest";

import { createDnsRecord } from "../../src/dns-record";
import { watchPropagation } from "../../src/watch/watch-propagation";
import { LIVE_TEST_TIMEOUT, describeLive } from "./live-test";

describeLive("live watchPropagation", () => {
  it(
    "observes an already-propagated public CNAME record",
    async () => {
      const domain = "namecheap.com";
      const record = createDnsRecord({
        type: "CNAME",
        name: "www.namecheap.com",
        value: "www.namecheap.com.cdn.cloudflare.net",
      });

      let finalStatus:
        | "propagated"
        | "partially-propagated"
        | "pending"
        | "timed-out"
        | "error"
        | undefined;

      for await (const result of watchPropagation({
        domain,
        records: [record],
        interval: 1_000,
        timeout: 10_000,
      })) {
        finalStatus = result.status;
        if (
          result.status === "propagated" ||
          result.status === "timed-out" ||
          result.status === "error"
        ) {
          break;
        }
      }

      expect(finalStatus).toBe("propagated");
    },
    LIVE_TEST_TIMEOUT,
  );
});
