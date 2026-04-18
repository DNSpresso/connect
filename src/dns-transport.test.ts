import { describe, expect, it, vi } from "vitest";

import { createDohTransport } from "./dns-transport";

describe("createDohTransport", () => {
  it("returns raw TXT answer data from the DoH response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Status: 0,
        Answer: [
          {
            name: "example.com",
            type: 16,
            TTL: 300,
            data: '"verification=" "token"',
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    try {
      const transport = createDohTransport();
      const result = await transport({ name: "example.com", type: "TXT" });

      expect(result).toEqual({
        status: "success",
        answers: [
          {
            name: "example.com",
            type: 16,
            ttl: 300,
            data: '"verification=" "token"',
          },
        ],
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
