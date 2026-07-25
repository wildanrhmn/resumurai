import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/** Lazy singleton — never touches the network until first use. */
let client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const model = () => process.env.MODEL ?? "claude-sonnet-5";
export const ocrModel = () => process.env.OCR_MODEL ?? "claude-haiku-4-5";
// Fast tier for the PAID A2MCP path: a full Sonnet tailoring run generates ~6k tokens
// (~42s), which overruns the buyer's HTTP read timeout. Haiku generates the same output
// far faster so the paid call completes well inside that window. The website /try path
// stays on the quality model — latency doesn't matter for a human staring at a spinner.
export const fastModel = () => process.env.FAST_MODEL ?? "claude-haiku-4-5";
const timeoutMs = () => Number(process.env.ANALYZE_TIMEOUT_MS ?? 90_000);

type Content = string | Anthropic.Messages.MessageParam["content"];

/**
 * One structured-output call. Returns the zod-validated object (the SDK retries
 * parse failures internally via the output_config contract).
 */
export async function parseWith<S extends z.ZodType>(
  schema: S,
  args: { system: string; content: Content; model?: string; maxTokens?: number },
): Promise<z.infer<S>> {
  const res = await getClient().messages.parse(
    {
      model: args.model ?? model(),
      max_tokens: args.maxTokens ?? 4096,
      system: args.system,
      messages: [{ role: "user", content: args.content as Anthropic.Messages.MessageParam["content"] }],
      output_config: { format: zodOutputFormat(schema) },
    },
    { timeout: timeoutMs() },
  );
  const out = res.parsed_output as z.infer<S> | null;
  if (out == null) throw new Error("model returned no structured output");
  return out;
}

/** Distinguish "we can't serve" (trip the breaker) from ordinary errors. */
export function isServiceUnavailableError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 401 || status === 402 || status === 429 || status === 529) return true;
  const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
  return /credit|billing|quota|balance|insufficient|authentication|api key|overloaded/.test(msg);
}
