import { describe, expect, it } from "vitest";

describe("@dnspresso/connect", () => {
  it("exports the expected runtime API", async () => {
    const loadedModule = await import("./index.js");

    expect(Object.keys(loadedModule).toSorted()).toEqual([
      "ConnectError",
      "HOST_FIELD_STRATEGIES",
      "createDnsRecord",
      "createDohTransport",
      "createSetupGuidance",
      "detectProvider",
      "parseDomainName",
      "watchPropagation",
    ]);
  });
});
