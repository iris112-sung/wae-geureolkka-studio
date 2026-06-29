import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
}

export async function saveGeneratedProductionAsset({
  jobId,
  fileName,
  mimeType,
  content
}: {
  jobId: string;
  fileName: string;
  mimeType: string;
  content: Buffer | string;
}) {
  const safeJobId = sanitizePathSegment(jobId);
  const directory = path.join(GENERATED_DIR, safeJobId);
  const filePath = path.join(directory, fileName);
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");

  if (process.env.VERCEL === "1" || process.env.IMAGE_STORAGE_MODE === "inline") {
    return {
      fileName,
      filePath: null,
      publicUrl: `data:${mimeType};base64,${buffer.toString("base64")}`
    };
  }

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, buffer);

  return {
    fileName,
    filePath,
    publicUrl: `/generated/${safeJobId}/${fileName}`
  };
}
