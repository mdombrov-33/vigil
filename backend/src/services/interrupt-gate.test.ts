import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// waitForChoice reads pause state from game-loop on every tick. Mock it so the
// countdown is fully controllable without spinning up the real game loop / DB.
vi.mock("@/services/game-loop.js", () => ({
  isSessionPaused: vi.fn(() => false),
}));

import { isSessionPaused } from "@/services/game-loop.js";
import {
  hasPendingInterrupt,
  resolveChoice,
  waitForChoice,
} from "@/services/interrupt-gate.js";

const paused = vi.mocked(isSessionPaused);

beforeEach(() => {
  vi.useFakeTimers();
  paused.mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("waitForChoice", () => {
  it("settles with the chosen id when the player resolves in time", async () => {
    const promise = waitForChoice("m1", "s1", 1000);
    expect(hasPendingInterrupt("m1")).toBe(true);

    expect(resolveChoice("m1", "opt-2")).toBe(true);

    await expect(promise).resolves.toBe("opt-2");
    expect(hasPendingInterrupt("m1")).toBe(false);
  });

  it("auto-fails (resolves null) after timeoutMs of unpaused time", async () => {
    const promise = waitForChoice("m2", "s2", 1000);

    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toBeNull();
    expect(hasPendingInterrupt("m2")).toBe(false);
  });

  it("freezes the countdown while the session is paused", async () => {
    paused.mockReturnValue(true);
    const promise = waitForChoice("m3", "s3", 1000);

    // Far past the timeout in wall-clock terms, but all of it is paused time.
    await vi.advanceTimersByTimeAsync(5000);
    expect(hasPendingInterrupt("m3")).toBe(true);

    // Resume — only now does elapsed accumulate toward the timeout.
    paused.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toBeNull();
  });
});

describe("resolveChoice", () => {
  it("returns false when no interrupt is pending for the mission", () => {
    expect(resolveChoice("unknown-mission", "x")).toBe(false);
  });
});
