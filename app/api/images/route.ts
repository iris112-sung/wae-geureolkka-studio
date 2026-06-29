import { NextResponse } from "next/server";
import { createMockScenePng } from "@/lib/ai/mock-image";
import { getAiConfig } from "@/lib/ai/config";
import { generateImageBufferWithOpenAI } from "@/lib/ai/openai";
import { jsonError } from "@/lib/api-response";
import { saveGeneratedSceneImage } from "@/lib/storage/images";
import {
  generatedImagesResponseSchema,
  type GeneratedImage,
  type Scene,
  imagesRequestSchema
} from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

const IMAGE_GENERATION_CONCURRENCY = 2;

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<TResult>
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex]);
      }
    })
  );

  return results;
}

async function generateAndSaveSceneImage({
  jobId,
  selectedTopic,
  scene,
  useMockAi
}: {
  jobId: string;
  selectedTopic: string;
  scene: Scene;
  useMockAi: boolean;
}): Promise<GeneratedImage> {
  const imageBuffer = useMockAi
    ? createMockScenePng(scene, selectedTopic)
    : await generateImageBufferWithOpenAI(scene, selectedTopic);
  const saved = await saveGeneratedSceneImage({
    jobId,
    sceneIndex: scene.index,
    imageBuffer
  });

  return {
    sceneIndex: scene.index,
    imageUrl: saved.publicUrl.startsWith("/generated/")
      ? `${saved.publicUrl}?v=${Date.now()}`
      : saved.publicUrl,
    fileName: saved.fileName,
    prompt: scene.imagePrompt
  };
}

export async function POST(request: Request) {
  try {
    const body = imagesRequestSchema.parse(await request.json());
    const config = getAiConfig();
    const images = await mapWithConcurrency(
      body.scenes,
      IMAGE_GENERATION_CONCURRENCY,
      (scene) =>
        generateAndSaveSceneImage({
          jobId: body.jobId,
          selectedTopic: body.selectedTopic,
          scene,
          useMockAi: config.useMockAi
        })
    );

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
