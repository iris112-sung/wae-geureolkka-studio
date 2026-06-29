import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TEXT_MODEL: z.string().default("gpt-5.5"),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-2"),
  OPENAI_TTS_MODEL: z.string().default("gpt-4o-mini-tts"),
  OPENAI_TTS_VOICE: z.string().default("coral"),
  USE_MOCK_AI: z.enum(["true", "false"]).default("false")
});

export function getAiConfig() {
  const env = envSchema.parse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_TEXT_MODEL: process.env.OPENAI_TEXT_MODEL,
    OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL,
    OPENAI_TTS_MODEL: process.env.OPENAI_TTS_MODEL,
    OPENAI_TTS_VOICE: process.env.OPENAI_TTS_VOICE,
    USE_MOCK_AI: process.env.USE_MOCK_AI
  });

  return {
    apiKey: env.OPENAI_API_KEY,
    textModel: env.OPENAI_TEXT_MODEL,
    imageModel: env.OPENAI_IMAGE_MODEL,
    ttsModel: env.OPENAI_TTS_MODEL,
    ttsVoice: env.OPENAI_TTS_VOICE,
    useMockAi: env.USE_MOCK_AI === "true"
  };
}

export function assertOpenAiApiKey(apiKey: string | undefined): asserts apiKey is string {
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY가 설정되지 않았습니다. 실제 API를 쓰려면 .env.local에 키를 넣거나, 로컬 검증은 USE_MOCK_AI=true로 실행해 주세요."
    );
  }
}
