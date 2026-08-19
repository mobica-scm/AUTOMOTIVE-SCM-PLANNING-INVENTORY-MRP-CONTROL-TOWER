import { describe, it, expect } from "vitest";
import { applyOrderPolicy } from "./orderPolicy";

describe("applyOrderPolicy", () => {
  it("returns 0 when there is no net requirement", () => {
    expect(applyOrderPolicy(0, 100, 50)).toBe(0);
    expect(applyOrderPolicy(-10, 100, 50)).toBe(0);
  });

  it("applies MOQ: net requirement 750, MOQ 1000 -> order 1000", () => {
    expect(applyOrderPolicy(750, 1000, 1)).toBe(1000);
  });

  it("applies order multiple: net requirement 1250, multiple 500 -> order 1500", () => {
    expect(applyOrderPolicy(1250, 0, 500)).toBe(1500);
  });

  it("applies MOQ then rounds to order multiple", () => {
    // net 300, MOQ 500, multiple 200 -> floor at 500, round up to 600
    expect(applyOrderPolicy(300, 500, 200)).toBe(600);
  });

  it("exact multiple stays as-is", () => {
    expect(applyOrderPolicy(1000, 0, 500)).toBe(1000);
  });
});
