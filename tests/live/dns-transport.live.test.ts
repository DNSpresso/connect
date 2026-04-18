import { expect, it } from "vitest";

import { createDohTransport } from "../../src/dns-transport";
import { LIVE_TEST_TIMEOUT, describeLive } from "./live-test";

describeLive("live DNS transport", () => {
  it(
    "resolves A records through the default DoH transport",
    async () => {
      const transport = createDohTransport();
      const result = await transport({
        name: "github.com",
        type: "A",
      });

      expect(result.status).toBe("success");
      if (result.status === "success") {
        expect(result.answers.length).toBeGreaterThan(0);
        expect(result.answers.some((answer) => answer.type === 1)).toBe(true);
      }
    },
    LIVE_TEST_TIMEOUT,
  );
});
