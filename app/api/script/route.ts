import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai/config";
import { generateMockScript } from "@/lib/ai/mock";
import { generateScriptWithOpenAI } from "@/lib/ai/openai";
import { jsonError } from "@/lib/api-response";
import { scriptRequestSchema, scriptResultSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = scriptRequestSchema.parse(await request.json());
    const config = getAiConfig();
    const draft = config.useMockAi
      ? generateMockScript(body)
      : await generateScriptWithOpenAI(body);
    const result = scriptResultSchema.parse({
      ...draft,
      jobId: crypto.randomUUID()
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
