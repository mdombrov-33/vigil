import type { ModelSettings } from "@openai/agents";

// MODEL_FULL — quality agents whose output the player directly reads
// MODEL_FAST — mechanical/structured agents, speed and cost optimized
export const MODEL_FULL = process.env.MODEL_FULL ?? "gpt-5.4";
export const MODEL_FAST = process.env.MODEL_FAST ?? "gpt-5.4-mini";

// Shared retry, spread into every agent. Covers transient HTTP and Zod output-parse failures.
export const RETRY: NonNullable<ModelSettings["retry"]> = {
  maxRetries: 3,
  backoff: { initialDelayMs: 1000, maxDelayMs: 8000, multiplier: 2, jitter: true },
  policy: ({ providerAdvice, normalized }) => {
    // Don't replay an unsafe request (possible tool write) or a caller-aborted one.
    if (providerAdvice?.replaySafety === "unsafe" || normalized.isAbort) return false;
    return true;
  },
};
