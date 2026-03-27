// MODEL_FULL — quality agents whose output the player directly reads
// MODEL_FAST — mechanical/structured agents, speed and cost optimized
export const MODEL_FULL = process.env.MODEL_FULL ?? "gpt-5.4";
export const MODEL_FAST = process.env.MODEL_FAST ?? "gpt-5.4-mini";
