import retry from "async-retry";

export function withRetry<T>(fn: () => Promise<T>, label?: string): Promise<T> {
  return retry(fn, {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 8000,
    randomize: true,
    onRetry: (err: Error, attempt) => {
      console.warn(`[retry] ${label ?? "operation"} — attempt ${attempt}/3 after error: ${err.message}`);
    },
  });
}
