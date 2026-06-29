import { z } from "zod";

export const topicCandidatesRequestSchema = z
  .object({
    idea: z.string().trim().min(3, "주제를 3자 이상 입력해 주세요.").max(400)
  })
  .strict();

export const topicCandidateSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(4).max(80),
    hook: z.string().min(8).max(140),
    angle: z.string().min(8).max(180),
    targetEmotion: z.string().min(2).max(40),
    whyItWorks: z.string().min(8).max(220)
  })
  .strict();

export const topicCandidatesResponseSchema = z
  .object({
    candidates: z.array(topicCandidateSchema).min(3).max(6)
  })
  .strict();

export const scriptRequestSchema = z
  .object({
    idea: z.string().trim().min(3).max(400),
    topic: topicCandidateSchema
  })
  .strict();

export const sceneSchema = z
  .object({
    index: z.number().int().min(1).max(8),
    title: z.string().min(2).max(70),
    durationSec: z.number().int().min(3).max(12),
    narration: z.string().min(10).max(260),
    caption: z.string().min(2).max(80),
    imagePrompt: z.string().min(30).max(900)
  })
  .strict();

export const scriptDraftSchema = z
  .object({
    title: z.string().min(4).max(90),
    selectedTopic: z.string().min(4).max(90),
    durationSec: z.number().int().min(20).max(70),
    hook: z.string().min(8).max(160),
    fullScript: z.string().min(80).max(2400),
    scenes: z.array(sceneSchema).min(4).max(7)
  })
  .strict();

export const scriptResultSchema = scriptDraftSchema
  .extend({
    jobId: z.string().min(8)
  })
  .strict();

export const imagesRequestSchema = z
  .object({
    jobId: z.string().min(8),
    selectedTopic: z.string().min(4).max(90),
    scenes: z.array(sceneSchema).min(1).max(8)
  })
  .strict();

export const generatedImageSchema = z
  .object({
    sceneIndex: z.number().int().min(1).max(8),
    imageUrl: z.string().min(1),
    fileName: z.string().min(1),
    prompt: z.string().min(1)
  })
  .strict();

export const generatedImagesResponseSchema = z
  .object({
    jobId: z.string().min(8),
    images: z.array(generatedImageSchema).min(1).max(8)
  })
  .strict();

export const ttsOptionsSchema = z
  .object({
    model: z.enum(["gpt-4o-mini-tts", "tts-1", "tts-1-hd"]),
    voice: z.enum([
      "alloy",
      "ash",
      "ballad",
      "coral",
      "echo",
      "fable",
      "onyx",
      "nova",
      "sage",
      "shimmer",
      "verse",
      "marin",
      "cedar"
    ]),
    speed: z.number().min(0.25).max(4),
    style: z.enum(["warm", "calm", "lively", "serious", "soft"]),
    customInstructions: z.string().trim().max(300).optional()
  })
  .strict();

export const productionAssetsRequestSchema = z
  .object({
    jobId: z.string().min(8),
    selectedTopic: z.string().min(4).max(90),
    scenes: z.array(sceneSchema).min(1).max(8),
    ttsOptions: ttsOptionsSchema.optional()
  })
  .strict();

export const captionCueSchema = z
  .object({
    sceneIndex: z.number().int().min(1).max(8),
    startSec: z.number().min(0),
    endSec: z.number().min(0),
    text: z.string().min(1).max(120)
  })
  .strict();

export const productionAssetsResponseSchema = z
  .object({
    jobId: z.string().min(8),
    plannedDurationSec: z.number().int().min(1).max(120),
    narrationText: z.string().min(1).max(4096),
    audioUrl: z.string().min(1),
    audioFileName: z.string().min(1),
    audioMimeType: z.string().min(1),
    vtt: z.string().min(1).max(6000),
    vttUrl: z.string().min(1),
    vttFileName: z.string().min(1),
    srt: z.string().min(1).max(6000),
    srtUrl: z.string().min(1),
    srtFileName: z.string().min(1),
    ttsOptions: ttsOptionsSchema,
    captions: z.array(captionCueSchema).min(1).max(8)
  })
  .strict();

export type TopicCandidatesRequest = z.infer<typeof topicCandidatesRequestSchema>;
export type TopicCandidate = z.infer<typeof topicCandidateSchema>;
export type TopicCandidatesResponse = z.infer<typeof topicCandidatesResponseSchema>;
export type ScriptRequest = z.infer<typeof scriptRequestSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type ScriptDraft = z.infer<typeof scriptDraftSchema>;
export type ScriptResult = z.infer<typeof scriptResultSchema>;
export type ImagesRequest = z.infer<typeof imagesRequestSchema>;
export type GeneratedImage = z.infer<typeof generatedImageSchema>;
export type GeneratedImagesResponse = z.infer<typeof generatedImagesResponseSchema>;
export type TtsOptions = z.infer<typeof ttsOptionsSchema>;
export type ProductionAssetsRequest = z.infer<typeof productionAssetsRequestSchema>;
export type CaptionCue = z.infer<typeof captionCueSchema>;
export type ProductionAssetsResponse = z.infer<
  typeof productionAssetsResponseSchema
>;
