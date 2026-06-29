import {
  scriptDraftSchema,
  topicCandidatesResponseSchema,
  type ScriptDraft,
  type ScriptRequest,
  type TopicCandidatesResponse
} from "@/lib/schemas";

const EXAMPLE_TOPICS = [
  "왜 월급날엔 돈을 더 쉽게 쓸까?",
  "답장이 늦으면 왜 더 신경 쓰일까?",
  "왜 해야 할 일을 미룰수록 더 불안할까?",
  "세일이라고 하면 왜 필요 없는 것도 사게 될까?",
  "왜 우리는 돈이 새는 걸 알면서도 같은 소비를 반복할까?"
];

function normalizeIdea(idea: string) {
  return idea.trim().replace(/\s+/g, " ");
}

export function generateMockTopicCandidates(idea: string): TopicCandidatesResponse {
  const seed = normalizeIdea(idea);
  const fallback = EXAMPLE_TOPICS[Math.abs(seed.length) % EXAMPLE_TOPICS.length];
  const base = seed.length > 8 ? seed : fallback;

  return topicCandidatesResponseSchema.parse({
    candidates: [
      {
        id: "topic-1",
        title: `${base} 진짜 이유`,
        hook: "내가 이상한 게 아니라, 뇌가 이렇게 반응하도록 설계되어 있습니다.",
        angle: "일상에서 바로 떠올릴 수 있는 장면으로 심리 메커니즘을 설명합니다.",
        targetEmotion: "공감",
        whyItWorks: "시청자가 이미 겪은 불편함을 먼저 인정하고, 짧은 해석으로 납득감을 줍니다."
      },
      {
        id: "topic-2",
        title: `${base}을 반복하는 순간`,
        hook: "분명 알고 있는데 또 반복한다면, 의지보다 환경 신호를 봐야 합니다.",
        angle: "행동 경제학과 습관 루프 관점으로 소비와 관계 반응을 연결합니다.",
        targetEmotion: "뜨끔함",
        whyItWorks: "반복 행동의 원인을 개인 탓이 아닌 구조로 풀어내 공유 욕구를 만듭니다."
      },
      {
        id: "topic-3",
        title: `${base} 뒤에 숨은 착각`,
        hook: "우리는 선택한다고 믿지만, 사실은 감정이 먼저 결제 버튼을 누릅니다.",
        angle: "감정, 보상, 불안 회피를 한 문장씩 끊어 리듬감 있게 전개합니다.",
        targetEmotion: "호기심",
        whyItWorks: "짧은 반전 문장으로 시작해 끝까지 보게 만드는 구조를 만들 수 있습니다."
      },
      {
        id: "topic-4",
        title: `${base}을 멈추기 어려운 이유`,
        hook: "멈추고 싶은데 멈추기 어렵다면, 보상보다 불안을 줄이는 중일 수 있습니다.",
        angle: "인간관계와 소비 습관을 관통하는 불안 완화 행동으로 풀어냅니다.",
        targetEmotion: "위로",
        whyItWorks: "문제를 비난하지 않고 설명해 저장과 댓글 반응을 유도하기 좋습니다."
      }
    ]
  });
}

export function generateMockScript({ idea, topic }: ScriptRequest): ScriptDraft {
  const cleanIdea = normalizeIdea(idea);
  const scenes = [
    {
      index: 1,
      title: "익숙한 장면",
      durationSec: 6,
      narration: `${topic.title}. 혹시 이 말, 오늘도 내 얘기처럼 느껴지지 않았나요?`,
      caption: "이거 내 얘기인가?",
      imagePrompt: `Vertical 9:16 cinematic illustration of a Korean everyday moment related to ${cleanIdea}, a person pausing before a phone or payment screen, realistic lifestyle lighting, subtle tension, no text, no logo`
    },
    {
      index: 2,
      title: "감정의 출발점",
      durationSec: 7,
      narration: "이 행동은 단순한 의지 문제가 아니라, 순간적인 불편함을 줄이려는 반응에 가깝습니다.",
      caption: "의지보다 빠른 감정",
      imagePrompt: `Vertical 9:16 realistic editorial image, close-up of anxious hands and a smartphone, soft indoor light, visual metaphor for emotional trigger and hesitation, Korean urban apartment mood, no text`
    },
    {
      index: 3,
      title: "뇌의 보상",
      durationSec: 7,
      narration: "뇌는 확실한 해결보다 빠른 안심을 더 좋아합니다. 그래서 작은 보상에 쉽게 끌립니다.",
      caption: "빠른 안심의 힘",
      imagePrompt: `Vertical 9:16 modern psychological concept image, warm light contrasting with cool shadows, everyday object as small reward, thoughtful Korean adult in background, cinematic, no text, no logo`
    },
    {
      index: 4,
      title: "반복되는 이유",
      durationSec: 8,
      narration: "문제는 그 안심이 오래가지 않는다는 겁니다. 그래서 비슷한 상황이 오면 같은 선택을 반복합니다.",
      caption: "안심은 짧다",
      imagePrompt: `Vertical 9:16 narrative still, repeating daily routine shown through layered reflections, Korean city evening, subtle loop metaphor, realistic but slightly stylized, no words, no logo`
    },
    {
      index: 5,
      title: "작은 해결",
      durationSec: 8,
      narration: "멈추고 싶다면 먼저 질문을 바꿔보세요. 지금 내가 원하는 건 해결일까요, 아니면 잠깐의 안심일까요?",
      caption: "질문을 바꾸기",
      imagePrompt: `Vertical 9:16 hopeful realistic lifestyle scene, Korean person writing a small note beside a phone, calm morning light, minimal desk, sense of self-awareness, no text, no logo`
    }
  ];

  return scriptDraftSchema.parse({
    title: topic.title,
    selectedTopic: topic.title,
    durationSec: scenes.reduce((sum, scene) => sum + scene.durationSec, 0),
    hook: topic.hook,
    fullScript: scenes
      .map((scene) => `${scene.index}. ${scene.narration}`)
      .join("\n"),
    scenes
  });
}
