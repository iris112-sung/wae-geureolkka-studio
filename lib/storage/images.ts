import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
}

export async function saveGeneratedSceneImage({
  jobId,
  sceneIndex,
  imageBuffer
}: {
  jobId: string;
  sceneIndex: number;
  imageBuffer: Buffer;
}) {
  const safeJobId = sanitizePathSegment(jobId);
  const fileName = `scene-${sceneIndex}.png`;
  const directory = path.join(GENERATED_DIR, safeJobId);
  const filePath = path.join(directory, fileName);

  if (process.env.VERCEL === "1" || process.env.IMAGE_STORAGE_MODE === "inline") {
    return {
      fileName,
      filePath: null,
      publicUrl: `data:image/png;base64,${imageBuffer.toString("base64")}`
    };
  }

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, imageBuffer);

  return {
    fileName,
    filePath,
    publicUrl: `/generated/${safeJobId}/${fileName}`
  };
}
