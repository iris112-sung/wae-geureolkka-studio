import type { TtsOptions } from "@/lib/schemas";

export const TTS_MODEL_OPTIONS = [
  {
    value: "gpt-4o-mini-tts",
    label: "4o mini TTS",
    description: "스타일 지시 가능"
  },
  {
    value: "tts-1",
    label: "TTS-1",
    description: "빠른 생성"
  },
  {
    value: "tts-1-hd",
    label: "TTS-1 HD",
    description: "고품질 음성"
  }
] as const;

export const TTS_VOICE_OPTIONS = [
  { value: "coral", label: "Coral", description: "밝고 또렷함" },
  { value: "alloy", label: "Alloy", description: "중립적" },
  { value: "ash", label: "Ash", description: "차분함" },
  { value: "ballad", label: "Ballad", description: "부드러움" },
  { value: "echo", label: "Echo", description: "선명함" },
  { value: "fable", label: "Fable", description: "이야기형" },
  { value: "onyx", label: "Onyx", description: "낮고 안정적" },
  { value: "nova", label: "Nova", description: "경쾌함" },
  { value: "sage", label: "Sage", description: "담백함" },
  { value: "shimmer", label: "Shimmer", description: "가벼움" },
  { value: "verse", label: "Verse", description: "리듬감" },
  { value: "marin", label: "Marin", description: "자연스러움" },
  { value: "cedar", label: "Cedar", description: "따뜻함" }
] as const;

export const TTS_STYLE_OPTIONS = [
  {
    value: "warm",
    label: "공감형",
    description: "따뜻하고 가까운 톤"
  },
  {
    value: "calm",
    label: "차분한 설명형",
    description: "느긋하고 안정적인 톤"
  },
  {
    value: "lively",
    label: "숏츠형",
    description: "빠르고 경쾌한 톤"
  },
  {
    value: "serious",
    label: "다큐형",
    description: "무게감 있고 또렷한 톤"
  },
  {
    value: "soft",
    label: "부드러운 상담형",
    description: "낮고 다정한 톤"
  }
] as const;

export const DEFAULT_TTS_OPTIONS: TtsOptions = {
  model: "gpt-4o-mini-tts",
  voice: "coral",
  speed: 1.04,
  style: "warm",
  customInstructions: ""
};

export function normalizeTtsOptions(options?: Partial<TtsOptions>): TtsOptions {
  return {
    ...DEFAULT_TTS_OPTIONS,
    ...options,
    speed: Number(options?.speed ?? DEFAULT_TTS_OPTIONS.speed),
    customInstructions: options?.customInstructions?.trim() ?? ""
  };
}

export function isTtsModel(value: string): value is TtsOptions["model"] {
  return TTS_MODEL_OPTIONS.some((option) => option.value === value);
}

export function isTtsVoice(value: string): value is TtsOptions["voice"] {
  return TTS_VOICE_OPTIONS.some((option) => option.value === value);
}

export function getTtsStyleInstructions(style: TtsOptions["style"]) {
  const instructions: Record<TtsOptions["style"], string> = {
    warm:
      "Warm, empathetic, clear, conversational Korean narration. Keep it intimate and easy to trust.",
    calm:
      "Calm, steady, explanatory Korean narration. Keep pauses natural and avoid sounding dramatic.",
    lively:
      "Energetic short-form Korean narration. Keep it slightly fast, crisp, and engaging without shouting.",
    serious:
      "Clear documentary-style Korean narration. Keep it grounded, precise, and emotionally restrained.",
    soft:
      "Soft counseling-style Korean narration. Keep it gentle, low-pressure, and reassuring."
  };

  return instructions[style];
}
