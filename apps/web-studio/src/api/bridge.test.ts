import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeChannel } from "./bridge";

describe("invokeChannel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns typed result for successful invoke", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { value: 42 } }),
      }),
    );

    const result = await invokeChannel<{ value: number }>("test-channel", {
      input: true,
    });
    expect(result.value).toBe(42);
  });

  it("throws bridge error message for failed invoke", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ ok: false, error: "boom" }),
      }),
    );

    await expect(invokeChannel("test-channel")).rejects.toThrow("boom");
  });
});
