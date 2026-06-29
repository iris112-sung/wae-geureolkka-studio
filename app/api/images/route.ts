import { NextResponse } from "next/server";
import { createMockScenePng } from "@/lib/ai/mock-image";
import { getAiConfig } from "@/lib/ai/config";
import { generateImageBufferWithOpenAI } from "@/lib/ai/openai";
import { jsonError } from "@/lib/api-response";
import { saveGeneratedSceneImage } from "@/lib/storage/images";
import {
  generatedImagesResponseSchema,
  imagesRequestSchema
} from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = imagesRequestSchema.parse(await request.json());
    const config = getAiConfig();
    const images = [];

    for (const scene of body.scenes) {
      const imageBuffer = config.useMockAi
        ? createMockScenePng(scene, body.selectedTopic)
        : await generateImageBufferWithOpenAI(scene, body.selectedTopic);
      const saved = await saveGeneratedSceneImage({
        jobId: body.jobId,
        sceneIndex: scene.index,
        imageBuffer
      });

      images.push({
        sceneIndex: scene.index,
        imageUrl: saved.publicUrl.startsWith("/generated/")
          ? `${saved.publicUrl}?v=${Date.now()}`
          : saved.publicUrl,
        fileName: saved.fileName,
        prompt: scene.imagePrompt
      });
    }

    return NextResponse.json(
      generatedImagesResponseSchema.parse({
        jobId: body.jobId,
        images
      })
    );
  } catch (error) {
    return jsonError(error);
  }
}
