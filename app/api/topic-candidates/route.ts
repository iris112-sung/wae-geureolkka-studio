import { NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai/config";
import { generateMockTopicCandidates } from "@/lib/ai/mock";
import { generateTopicCandidatesWithOpenAI } from "@/lib/ai/openai";
import { jsonError } from "@/lib/api-response";
import { topicCandidatesRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = topicCandidatesRequestSchema.parse(await request.json());
    const config = getAiConfig();
    const result = config.useMockAi
      ? generateMockTopicCandidates(body.idea)
      : await generateTopicCandidatesWithOpenAI(body.idea);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
