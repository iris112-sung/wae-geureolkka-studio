import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { assertOpenAiApiKey, getAiConfig } from "@/lib/ai/config";
import {
  scriptDraftSchema,
  topicCandidatesResponseSchema,
  type Scene,
  type ScriptDraft,
  type ScriptRequest,
  type TopicCandidatesResponse
} from "@/lib/schemas";

let client: OpenAI | null = null;

function getClient(apiKey: string) {
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

function parseResponse<TSchema extends z.ZodTypeAny>(
  response: { output_parsed?: unknown; output_text?: string },
  schema: TSchema
): z.infer<TSchema> {
  const parsed =
    response.output_parsed ??
    (response.output_text ? JSON.parse(response.output_text) : undefined);

  return schema.parse(parsed);
}

export async function generateTopicCandidatesWithOpenAI(
  idea: string
): Promise<TopicCandidatesResponse> {
  const config = getAiConfig();
  assertOpenAiApiKey(config.apiKey);
  const openai = getClient(config.apiKey);

  const response = await openai.responses.parse({
    model: config.textModel,
    input: [
      {
        role: "system",
        content:
          "너는 '왜그럴까 스튜디오'의 숏츠 기획자다. 일상 심리, 인간관계, 소비 습관을 다루는 한국어 유튜브 숏츠 주제를 만든다. 자극적 과장보다 공감, 반전, 실용적 통찰을 우선한다."
      },
      {
        role: "user",
        content: `사용자 아이디어: ${idea}\n\n요청: 30~45초 숏츠로 만들기 좋은 주제 후보 4개를 생성해라. 각 후보는 제목, 첫 3초 후킹 문장, 접근 각도, 목표 감정, 왜 잘 먹히는지를 포함한다.`
      }
    ],
    text: {
      format: zodTextFormat(topicCandidatesResponseSchema, "topic_candidates")
    },
    max_output_tokens: 1800
  });

  return parseResponse(response, topicCandidatesResponseSchema);
}

export async function generateScriptWithOpenAI(
  request: ScriptRequest
): Promise<ScriptDraft> {
  const config = getAiConfig();
  assertOpenAiApiKey(config.apiKey);
  const openai = getClient(config.apiKey);

  const response = await openai.responses.parse({
    model: config.textModel,
    input: [
      {
        role: "system",
        content:
          "너는 한국어 유튜브 숏츠 작가이자 이미지 프롬프트 디렉터다. 20~45초 내외의 짧은 영상 스크립트를 씬 단위로 만든다. 결과는 자연스러운 한국어 내레이션, 화면 자막, 각 씬별 이미지 생성 프롬프트를 포함해야 한다."
      },
      {
        role: "user",
        content: `원래 아이디어: ${request.idea}\n선택한 주제: ${request.topic.title}\n후킹 문장: ${request.topic.hook}\n접근 각도: ${request.topic.angle}\n\n요청:\n- 4~6개 씬으로 구성\n- 전체 길이 25~45초\n- 첫 씬은 바로 공감되는 상황\n- 마지막 씬은 저장하고 싶은 한 문장 질문 또는 행동 제안\n- imagePrompt는 9:16 세로 이미지, 한국 일상 분위기, 텍스트/로고 없음 조건을 포함\n- 전문용어는 피하고 짧은 문장으로 작성`
      }
    ],
    text: {
      format: zodTextFormat(scriptDraftSchema, "shorts_script")
    },
    max_output_tokens: 2600
  });

  return parseResponse(response, scriptDraftSchema);
}

export async function generateImageBufferWithOpenAI(
  scene: Scene,
  selectedTopic: string
) {
  const config = getAiConfig();
  assertOpenAiApiKey(config.apiKey);
  const openai = getClient(config.apiKey);

  const prompt = [
    `You are creating one vertical still image for a Korean YouTube Shorts video titled "${selectedTopic}".`,
    scene.imagePrompt,
    "Use a 9:16 composition, realistic editorial style, emotionally clear subject, no readable text, no subtitles, no watermarks, no logos."
  ].join("\n");

  const result = await openai.images.generate({
    model: config.imageModel,
    prompt,
    size: "1024x1536"
  } as never);

  const image = result.data?.[0];

  if (image?.b64_json) {
    return Buffer.from(image.b64_json, "base64");
  }

  if (image?.url) {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error("이미지 URL에서 파일을 내려받지 못했습니다.");
    }
    return Buffer.from(await imageResponse.arrayBuffer());
  }

  throw new Error("OpenAI 이미지 응답에서 저장할 이미지를 찾지 못했습니다.");
}
