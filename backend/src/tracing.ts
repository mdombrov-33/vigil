import {
  addTraceProcessor,
  BatchTraceProcessor,
  OpenAITracingExporter,
} from "@openai/agents";

export function initTracing() {
  addTraceProcessor(new BatchTraceProcessor(new OpenAITracingExporter()));
}
