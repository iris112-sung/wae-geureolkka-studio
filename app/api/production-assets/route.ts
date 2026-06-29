import { NextResponse } from "next/server";
import { createMockSpeechWav } from "@/lib/ai/mock-audio";
import { getAiConfig } from "@/lib/ai/config";
import { generateSpeechBufferWithOpenAI } from "@/lib/ai/openai";
import { jsonError } from "@/lib/api-response";
import { saveGeneratedProductionAsset } from "@/lib/storage/production-assets";
import {
  productionAssetsRequestSchema,
  productionAssetsResponseSchema,
  type CaptionCue,
  type Scene
} from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

function formatTimestamp(totalSeconds: number, separator: "." | ",") {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.round((safeSeconds - Math.floor(safeSeconds)) * 1000);

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    `${String(seconds).padStart(2, "0")}${separator}${String(milliseconds).padStart(3, "0")}`
  ].join(":");
}

function buildCaptionCues(scenes: Scene[]): CaptionCue[] {
  let cursor = 0;

  return scenes.map((scene) => {
    const startSec = cursor;
    const endSec = cursor + scene.durationSec;
    cursor = endSec;

    return {
      sceneIndex: scene.index,
      startSec,
      endSec,
      text: scene.caption
    };
  });
}

function buildVtt(captions: CaptionCue[]) {
  return [
    "WEBVTT",
    "",
    ...captions.flatMap((caption) => [
      `${formatTimestamp(caption.startSec, ".")} --> ${formatTimestamp(caption.endSec, ".")}`,
      caption.text,
      ""
    ])
  ].join("\n");
}

function buildSrt(captions: CaptionCue[]) {
  return captions
    .flatMap((caption, index) => [
      String(index + 1),
      `${formatTimestamp(caption.startSec, ",")} --> ${formatTimestamp(caption.endSec, ",")}`,
      caption.text,
      ""
    ])
    .join("\n");
}

function buildNarrationText(scenes: Scene[]) {
  return scenes.map((scene) => scene.narration).join("\n\n").slice(0, 4096);
}

export async function POST(request: Request) {
  try {
    const body = productionAssetsRequestSchema.parse(await request.json());
    const config = getAiConfig();
    const captions = buildCaptionCues(body.scenes);
    const plannedDurationSec = body.scenes.reduce(
      (sum, scene) => sum + scene.durationSec,
      0
    );
    const narrationText = buildNarrationText(body.scenes);
    const vtt = buildVtt(captions);
    const srt = buildSrt(captions);
    const audioMimeType = config.useMockAi ? "audio/wav" : "audio/mpeg";
    const audioFileName = config.useMockAi ? "voiceover.wav" : "voiceover.mp3";
    const audioBuffer = config.useMockAi
      ? createMockSpeechWav(plannedDurationSec)
      : await generateSpeechBufferWithOpenAI({
          narrationText,
          selectedTopic: body.selectedTopic
        });

    const [audioAsset, vttAsset, srtAsset] = await Promise.all([
      saveGeneratedProductionAsset({
        jobId: body.jobId,
        fileName: audioFileName,
        mimeType: audioMimeType,
        content: audioBuffer
      }),
      saveGeneratedProductionAsset({
        jobId: body.jobId,
        fileName: "captions.vtt",
        mimeType: "text/vtt;charset=utf-8",
        content: vtt
      }),
      saveGeneratedProductionAsset({
        jobId: body.jobId,
        fileName: "captions.srt",
        mimeType: "application/x-subrip;charset=utf-8",
        content: srt
      })
    ]);

    return NextResponse.json(
      productionAssetsResponseSchema.parse({
        jobId: body.jobId,
        plannedDurationSec,
        narrationText,
        audioUrl: audioAsset.publicUrl,
        audioFileName: audioAsset.fileName,
        audioMimeType,
        vtt,
        vttUrl: vttAsset.publicUrl,
        vttFileName: vttAsset.fileName,
        srt,
        srtUrl: srtAsset.publicUrl,
        srtFileName: srtAsset.fileName,
        captions
      })
    );
  } catch (error) {
    return jsonError(error);
  }
}
