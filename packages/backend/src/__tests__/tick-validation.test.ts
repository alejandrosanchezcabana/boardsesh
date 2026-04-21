import { describe, it, expect } from "vite-plus/test";
import { UpdateTickInputSchema } from "../validation/schemas/ticks";

describe("UpdateTickInputSchema", () => {
  it("accepts a one-try send so existing quick-tick rows remain editable", () => {
    expect(() =>
      UpdateTickInputSchema.parse({
        status: "send",
        attemptCount: 1,
        quality: 4,
        difficulty: 22,
        comment: "Still counts",
      }),
    ).not.toThrow();
  });

  it("still rejects flashes with attempt counts above one", () => {
    expect(() =>
      UpdateTickInputSchema.parse({
        status: "flash",
        attemptCount: 2,
      }),
    ).toThrowError(/Flash requires attemptCount of 1/);
  });
});
