import { expect, it } from "vitest";

import { detectProvider } from "../../src/detect/detect-provider";
import { LIVE_TEST_TIMEOUT, describeLive } from "./live-test";

describeLive("live detectProvider", () => {
  it(
    "detects Namecheap from the live nameservers for namecheap.com",
    async () => {
      const domain = "namecheap.com";
      const result = await detectProvider({ domain });

      expect(result.status).toBe("detected");
      if (result.status === "detected") {
        expect(result.providerId).toBe("namecheap");
        expect(result.nameservers.length).toBeGreaterThan(0);
      }
    },
    LIVE_TEST_TIMEOUT,
  );
});
