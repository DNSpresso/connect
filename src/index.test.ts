import { describe, expect, it } from "vitest";

describe("@dnspresso/connect", () => {
  it("loads the package entrypoint", async () => {
    const loadedModule = await import("./index.js");

    expect(Object.keys(loadedModule)).toEqual([]);
  });
});
