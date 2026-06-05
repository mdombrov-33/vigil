import { afterEach, describe, expect, it, vi } from "vitest";
import { getCooldownUntil, rollHealthAfterFailure } from "@/services/cooldown.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("getCooldownUntil", () => {
  it("returns null for a downed hero (recovery is handled manually)", () => {
    expect(getCooldownUntil("down")).toBeNull();
  });

  it("rests a healthy hero for 30s", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    expect(getCooldownUntil("healthy")).toEqual(new Date("2026-01-01T00:00:30.000Z"));
  });

  it("rests an injured hero longer — 90s", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    expect(getCooldownUntil("injured")).toEqual(new Date("2026-01-01T00:01:30.000Z"));
  });
});

describe("rollHealthAfterFailure", () => {
  it("keeps a downed hero down regardless of the roll", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(rollHealthAfterFailure("down")).toBe("down");
  });

  describe("healthy hero", () => {
    it("stays healthy below the 0.6 threshold", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.59);
      expect(rollHealthAfterFailure("healthy")).toBe("healthy");
    });

    it("becomes injured between 0.6 and 0.9", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.6);
      expect(rollHealthAfterFailure("healthy")).toBe("injured");
    });

    it("goes down at or above 0.9", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.9);
      expect(rollHealthAfterFailure("healthy")).toBe("down");
    });
  });

  describe("already-injured hero", () => {
    it("goes down below the 0.6 threshold (already compromised)", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.59);
      expect(rollHealthAfterFailure("injured")).toBe("down");
    });

    it("stays injured at or above 0.6", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.6);
      expect(rollHealthAfterFailure("injured")).toBe("injured");
    });
  });
});
