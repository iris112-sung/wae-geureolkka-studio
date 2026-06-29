"use client";

import {
  ArrowRight,
  BadgeCheck,
  Captions,
  CheckCircle2,
  Clapperboard,
  Clipboard,
  Copy,
  Download,
  FileAudio,
  FileText,
  Image as ImageIcon,
  Images,
  Loader2,
  Mic2,
  RefreshCw,
  Sparkles,
  WandSparkles
} from "lucide-react";
import NextImage from "next/image";
import { useEffect, useMemo, useState } from "react";
import type {
  GeneratedImage,
  GeneratedImagesResponse,
  ProductionAssetsResponse,
  Scene,
  ScriptResult,
  TopicCandidate,
  TopicCandidatesResponse
} from "@/lib/schemas";
import {
  renderShortsVideo,
  type RenderedVideoAsset,
  type VideoRenderProgress
} from "@/lib/video/browser-render";

type LoadingState = "topics" | "script" | "images" | "voiceover" | "video" | null;

const EXAMPLE_IDEAS = [
  "왜 월급날엔 돈을 더 쉽게 쓸까?",
  "답장이 늦으면 왜 더 신경 쓰일까?",
  "왜 해야 할 일을 미룰수록 더 불안할까?",
  "세일이라고 하면 왜 필요 없는 것도 사게 될까?",
  "왜 우리는 돈이 새는 걸 알면서도 같은 소비를 반복할까?"
];

const WORKFLOW_STEPS = [
  {
    id: 1,
    title: "주제 입력",
    icon: Sparkles
  },
  {
    id: 2,
    title: "주제 후보 생성",
    icon: WandSparkles
  },
  {
    id: 3,
    title: "숏츠 스크립트 생성",
    icon: FileText
  },
  {
    id: 4,
    title: "이미지·영상 생성",
    icon: Clapperboard
  }
];

const IMAGE_REQUEST_CONCURRENCY = 2;

type ImageProgress = {
  completed: number;
  total: number;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error ?? "요청 처리에 실패했습니다.");
  }

  return data as TResponse;
}

function downloadText(fileName: string, text: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadUrl(fileName: string, url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function buildMarkdown(script: ScriptResult, images: GeneratedImage[]) {
  const imageMap = new Map(images.map((image) => [image.sceneIndex, image]));

  return [
    `# ${script.title}`,
    "",
    `- Job ID: ${script.jobId}`,
    `- 전체 길이: ${script.durationSec}초`,
    `- 훅: ${script.hook}`,
    "",
    "## 전체 스크립트",
    script.fullScript,
    "",
    "## 씬 구성",
    ...script.scenes.flatMap((scene) => [
      "",
      `### Scene ${scene.index}. ${scene.title}`,
      `- 길이: ${scene.durationSec}초`,
      `- 내레이션: ${scene.narration}`,
      `- 자막: ${scene.caption}`,
      `- 이미지 프롬프트: ${scene.imagePrompt}`,
      imageMap.get(scene.index)
        ? `- 이미지 파일: ${imageMap.get(scene.index)?.fileName}`
        : "- 이미지 파일: 미생성"
    ])
  ].join("\n");
}

function sortGeneratedImages(images: GeneratedImage[]) {
  return [...images].sort((a, b) => a.sceneIndex - b.sceneIndex);
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        await worker(item);
      }
    })
  );
}

export default function Home() {
  const [idea, setIdea] = useState(EXAMPLE_IDEAS[0]);
  const [candidates, setCandidates] = useState<TopicCandidate[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [scriptResult, setScriptResult] = useState<ScriptResult | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [productionAssets, setProductionAssets] =
    useState<ProductionAssetsResponse | null>(null);
  const [renderedVideo, setRenderedVideo] = useState<RenderedVideoAsset | null>(null);
  const [imageProgress, setImageProgress] = useState<ImageProgress | null>(null);
  const [videoProgress, setVideoProgress] = useState<VideoRenderProgress | null>(null);
  const [generatingSceneIndexes, setGeneratingSceneIndexes] = useState<Set<number>>(
    () => new Set()
  );
  const [loading, setLoading] = useState<LoadingState>(null);
  const [error, setError] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string>("");

  const selectedTopic = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedTopicId) ?? null,
    [candidates, selectedTopicId]
  );

  const imagesByScene = useMemo(
    () => new Map(generatedImages.map((image) => [image.sceneIndex, image])),
    [generatedImages]
  );

  const hasAllImages = useMemo(
    () => {
      if (!scriptResult) return false;
      return scriptResult.scenes.every((scene) => imagesByScene.has(scene.index));
    },
    [imagesByScene, scriptResult]
  );

  const activeStep = useMemo(() => {
    if (scriptResult) return 4;
    if (selectedTopic) return 3;
    if (candidates.length > 0) return 2;
    return 1;
  }, [candidates.length, scriptResult, selectedTopic]);

  const markdown = useMemo(
    () => (scriptResult ? buildMarkdown(scriptResult, generatedImages) : ""),
    [generatedImages, scriptResult]
  );

  const isBusy = loading !== null;

  useEffect(() => {
    return () => {
      if (renderedVideo?.videoUrl) {
        URL.revokeObjectURL(renderedVideo.videoUrl);
      }
    };
  }, [renderedVideo?.videoUrl]);

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(""), 1200);
    } catch {
      setError("클립보드 복사 권한을 확인해 주세요.");
    }
  }

  async function handleGenerateTopics() {
    setError("");
    setLoading("topics");
    setCandidates([]);
    setSelectedTopicId("");
    setScriptResult(null);
    setGeneratedImages([]);
    setProductionAssets(null);
    setRenderedVideo(null);
    setImageProgress(null);
    setVideoProgress(null);
    setGeneratingSceneIndexes(new Set());

    try {
      const result = await postJson<TopicCandidatesResponse>("/api/topic-candidates", {
        idea
      });
      setCandidates(result.candidates);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "주제 후보 생성에 실패했습니다."
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleGenerateScript() {
    if (!selectedTopic) return;

    setError("");
    setLoading("script");
    setScriptResult(null);
    setGeneratedImages([]);
    setProductionAssets(null);
    setRenderedVideo(null);
    setImageProgress(null);
    setVideoProgress(null);
    setGeneratingSceneIndexes(new Set());

    try {
      const result = await postJson<ScriptResult>("/api/script", {
        idea,
        topic: selectedTopic
      });
      setScriptResult(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "스크립트 생성에 실패했습니다."
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleGenerateImages() {
    if (!scriptResult) return;

    setError("");
    setLoading("images");
    setGeneratedImages([]);
    setRenderedVideo(null);
    setImageProgress({
      completed: 0,
      total: scriptResult.scenes.length
    });
    setGeneratingSceneIndexes(
      new Set(scriptResult.scenes.map((scene) => scene.index))
    );

    try {
      const sceneErrors: string[] = [];

      await runWithConcurrency<Scene>(
        scriptResult.scenes,
        IMAGE_REQUEST_CONCURRENCY,
        async (scene) => {
          try {
            const result = await postJson<GeneratedImagesResponse>("/api/images", {
              jobId: scriptResult.jobId,
              selectedTopic: scriptResult.selectedTopic,
              scenes: [scene]
            });
            const image = result.images[0];

            if (!image) {
              throw new Error(`Scene ${scene.index} 이미지 응답이 비어 있습니다.`);
            }

            setGeneratedImages((currentImages) =>
              sortGeneratedImages([
                ...currentImages.filter(
                  (currentImage) => currentImage.sceneIndex !== image.sceneIndex
                ),
                image
              ])
            );
          } catch (sceneError) {
            sceneErrors.push(
              sceneError instanceof Error
                ? `Scene ${scene.index}: ${sceneError.message}`
                : `Scene ${scene.index}: 이미지 생성 실패`
            );
          } finally {
            setImageProgress((currentProgress) =>
              currentProgress
                ? {
                    ...currentProgress,
                    completed: Math.min(
                      currentProgress.completed + 1,
                      currentProgress.total
                    )
                  }
                : currentProgress
            );
            setGeneratingSceneIndexes((currentIndexes) => {
              const nextIndexes = new Set(currentIndexes);
              nextIndexes.delete(scene.index);
              return nextIndexes;
            });
          }
        }
      );

      if (sceneErrors.length > 0) {
        throw new Error(
          `${sceneErrors.length}개 씬 이미지 생성에 실패했습니다. ${sceneErrors[0]}`
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "씬 이미지 생성에 실패했습니다."
      );
    } finally {
      setImageProgress(null);
      setGeneratingSceneIndexes(new Set());
      setLoading(null);
    }
  }

  async function handleGenerateProductionAssets() {
    if (!scriptResult) return;

    setError("");
    setLoading("voiceover");
    setProductionAssets(null);
    setRenderedVideo(null);
    setVideoProgress(null);

    try {
      const result = await postJson<ProductionAssetsResponse>(
        "/api/production-assets",
        {
          jobId: scriptResult.jobId,
          selectedTopic: scriptResult.selectedTopic,
          scenes: scriptResult.scenes
        }
      );
      setProductionAssets(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "TTS 음성 및 자막 생성에 실패했습니다."
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleRenderVideo() {
    if (!scriptResult || !productionAssets) return;

    setError("");
    setLoading("video");
    setRenderedVideo(null);
    setVideoProgress({
      phase: "preparing",
      percent: 1
    });

    try {
      const video = await renderShortsVideo({
        jobId: scriptResult.jobId,
        title: scriptResult.title,
        scenes: scriptResult.scenes,
        images: generatedImages,
        captions: productionAssets.captions,
        audioUrl: productionAssets.audioUrl,
        plannedDurationSec: productionAssets.plannedDurationSec,
        onProgress: setVideoProgress
      });
      setRenderedVideo(video);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "영상 렌더링에 실패했습니다."
      );
    } finally {
      setVideoProgress(null);
      setLoading(null);
    }
  }

  function exportJson() {
    if (!scriptResult) return;

    downloadText(
      `${scriptResult.jobId}-wae-geureolkka.json`,
      JSON.stringify({ script: scriptResult, images: generatedImages }, null, 2),
      "application/json"
    );
  }

  function exportMarkdown() {
    if (!scriptResult) return;

    downloadText(
      `${scriptResult.jobId}-wae-geureolkka.md`,
      markdown,
      "text/markdown;charset=utf-8"
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-neutral-950">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-[1380px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#183c38] text-white">
              <WandSparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-black tracking-normal">왜그럴까 스튜디오</p>
              <p className="text-xs font-semibold text-neutral-500">
                Shorts workflow MVP
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 text-xs font-bold text-neutral-600 sm:flex">
            <BadgeCheck className="h-4 w-4 text-[#23968b]" aria-hidden="true" />
            일상 심리 · 인간관계 · 소비 습관
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1380px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-panel">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-neutral-500">
                Progress
              </span>
              <span className="rounded-md bg-[#e9f5f3] px-2 py-1 text-xs font-black text-[#183c38]">
                {activeStep}/4
              </span>
            </div>

            <ol className="grid gap-2">
              {WORKFLOW_STEPS.map((step) => {
                const Icon = step.icon;
                const complete =
                  (step.id === 1 && idea.trim().length >= 3) ||
                  (step.id === 2 && Boolean(selectedTopic)) ||
                  (step.id === 3 && Boolean(scriptResult)) ||
                  (step.id === 4 && generatedImages.length > 0);
                const current = step.id === activeStep;

                return (
                  <li key={step.id}>
                    <a
                      href={`#step-${step.id}`}
                      className={cx(
                        "focus-ring flex items-center gap-3 rounded-md border px-3 py-3 transition",
                        current
                          ? "border-[#183c38] bg-[#f1faf8]"
                          : "border-neutral-200 bg-white hover:border-neutral-300",
                        complete && !current && "border-[#bfe6dc] bg-[#fbfffd]"
                      )}
                    >
                      <span
                        className={cx(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-md",
                          current
                            ? "bg-[#183c38] text-white"
                            : complete
                              ? "bg-[#dff5ef] text-[#16796f]"
                              : "bg-neutral-100 text-neutral-500"
                        )}
                      >
                        {complete ? (
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        )}
                      </span>
                      <span>
                        <span className="block text-sm font-black">{step.title}</span>
                        <span className="block text-xs font-semibold text-neutral-500">
                          Step {step.id}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>

        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-panel">
          {error ? (
            <div className="border-b border-[#f1c9bc] bg-[#fff6f2] px-4 py-3 text-sm font-bold text-[#9c3f2d] sm:px-6">
              {error}
            </div>
          ) : null}

          <StepSection
            id="step-1"
            number="01"
            title="주제 입력"
            stateLabel={idea.trim().length >= 3 ? "입력됨" : "대기"}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div>
                <label
                  htmlFor="idea"
                  className="mb-2 block text-sm font-black text-neutral-800"
                >
                  콘텐츠 아이디어
                </label>
                <textarea
                  id="idea"
                  value={idea}
                  onChange={(event) => setIdea(event.target.value)}
                  className="focus-ring min-h-36 w-full resize-y rounded-lg border border-neutral-300 bg-white px-4 py-3 text-base font-semibold leading-7 text-neutral-900 outline-none transition placeholder:text-neutral-400"
                  placeholder="예: 왜 월급날엔 돈을 더 쉽게 쓸까?"
                />
              </div>

              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-neutral-500">
                  Examples
                </p>
                <div className="grid gap-2">
                  {EXAMPLE_IDEAS.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setIdea(example)}
                      className="focus-ring rounded-md border border-neutral-200 bg-white px-3 py-2 text-left text-sm font-bold text-neutral-700 transition hover:border-[#23968b] hover:text-[#183c38]"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <PrimaryButton
                onClick={handleGenerateTopics}
                disabled={idea.trim().length < 3 || isBusy}
                loading={loading === "topics"}
                icon={WandSparkles}
              >
                후보 생성
              </PrimaryButton>
              <span className="text-sm font-semibold text-neutral-500">
                {idea.trim().length}자
              </span>
            </div>
          </StepSection>

          <StepSection
            id="step-2"
            number="02"
            title="주제 후보 생성"
            stateLabel={selectedTopic ? "선택됨" : candidates.length ? "후보 있음" : "대기"}
          >
            {candidates.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {candidates.map((candidate) => {
                  const selected = candidate.id === selectedTopicId;

                  return (
                    <article
                      key={candidate.id}
                      className={cx(
                        "rounded-lg border p-4 transition",
                        selected
                          ? "border-[#183c38] bg-[#f1faf8]"
                          : "border-neutral-200 bg-white hover:border-neutral-300"
                      )}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <h3 className="text-lg font-black leading-snug">
                          {candidate.title}
                        </h3>
                        <span className="shrink-0 rounded-md bg-[#ffe8df] px-2 py-1 text-xs font-black text-[#9c3f2d]">
                          {candidate.targetEmotion}
                        </span>
                      </div>
                      <p className="mb-3 text-sm font-bold leading-6 text-neutral-700">
                        {candidate.hook}
                      </p>
                      <dl className="grid gap-2 text-sm">
                        <div>
                          <dt className="font-black text-neutral-500">각도</dt>
                          <dd className="font-semibold text-neutral-800">
                            {candidate.angle}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-black text-neutral-500">작동 이유</dt>
                          <dd className="font-semibold text-neutral-800">
                            {candidate.whyItWorks}
                          </dd>
                        </div>
                      </dl>
                      <button
                        type="button"
                        onClick={() => {
                        setSelectedTopicId(candidate.id);
                        setScriptResult(null);
                        setGeneratedImages([]);
                        setProductionAssets(null);
                        setRenderedVideo(null);
                        setImageProgress(null);
                        setVideoProgress(null);
                        setGeneratingSceneIndexes(new Set());
                      }}
                        className={cx(
                          "focus-ring mt-4 inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-black transition",
                          selected
                            ? "bg-[#183c38] text-white"
                            : "bg-neutral-900 text-white hover:bg-neutral-700"
                        )}
                      >
                        {selected ? "선택됨" : "선택"}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={WandSparkles}
                title="아직 후보가 없습니다"
                text="아이디어를 입력하고 후보 생성을 실행하세요."
              />
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SecondaryButton
                onClick={handleGenerateTopics}
                disabled={idea.trim().length < 3 || isBusy}
                loading={loading === "topics"}
                icon={RefreshCw}
              >
                후보 다시 생성
              </SecondaryButton>
              <PrimaryButton
                onClick={handleGenerateScript}
                disabled={!selectedTopic || isBusy}
                loading={loading === "script"}
                icon={FileText}
              >
                스크립트 생성
              </PrimaryButton>
            </div>
          </StepSection>

          <StepSection
            id="step-3"
            number="03"
            title="숏츠 스크립트 생성"
            stateLabel={scriptResult ? "완료" : selectedTopic ? "준비됨" : "대기"}
          >
            {scriptResult ? (
              <div className="grid gap-4">
                <div className="rounded-lg border border-neutral-200 bg-[#fbfbfc] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-neutral-500">
                        Script
                      </p>
                      <h3 className="mt-1 text-2xl font-black leading-tight">
                        {scriptResult.title}
                      </h3>
                    </div>
                    <span className="rounded-md bg-[#e9f5f3] px-3 py-2 text-sm font-black text-[#183c38]">
                      {scriptResult.durationSec}초
                    </span>
                  </div>
                  <p className="mt-3 text-base font-bold leading-7 text-neutral-700">
                    {scriptResult.hook}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <IconButton
                      label={copiedKey === "script" ? "복사됨" : "스크립트 복사"}
                      icon={Copy}
                      onClick={() => copyText("script", scriptResult.fullScript)}
                    />
                    <IconButton
                      label="Markdown 다운로드"
                      icon={Download}
                      onClick={exportMarkdown}
                    />
                    <IconButton label="JSON 다운로드" icon={Download} onClick={exportJson} />
                  </div>
                </div>

                <div className="grid gap-3">
                  {scriptResult.scenes.map((scene) => (
                    <article
                      key={scene.index}
                      className="rounded-lg border border-neutral-200 bg-white p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-base font-black">
                          Scene {scene.index}. {scene.title}
                        </h4>
                        <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-black text-neutral-600">
                          {scene.durationSec}초
                        </span>
                      </div>
                      <p className="text-sm font-bold leading-6 text-neutral-800">
                        {scene.narration}
                      </p>
                      <p className="mt-2 inline-flex rounded-md bg-[#fff0e8] px-2 py-1 text-sm font-black text-[#9c3f2d]">
                        {scene.caption}
                      </p>
                      <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-black uppercase tracking-[0.14em] text-neutral-500">
                            Image Prompt
                          </span>
                          <button
                            type="button"
                            title="프롬프트 복사"
                            aria-label="프롬프트 복사"
                            onClick={() =>
                              copyText(`prompt-${scene.index}`, scene.imagePrompt)
                            }
                            className="focus-ring grid h-8 w-8 place-items-center rounded-md bg-white text-neutral-700 transition hover:bg-neutral-900 hover:text-white"
                          >
                            <Clipboard className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                        <p className="text-sm font-semibold leading-6 text-neutral-700">
                          {scene.imagePrompt}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : selectedTopic ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div>
                  <p className="text-sm font-black text-neutral-500">선택한 주제</p>
                  <p className="text-lg font-black">{selectedTopic.title}</p>
                </div>
                <PrimaryButton
                  onClick={handleGenerateScript}
                  disabled={isBusy}
                  loading={loading === "script"}
                  icon={FileText}
                >
                  스크립트 생성
                </PrimaryButton>
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="선택한 주제가 없습니다"
                text="후보 카드에서 하나를 선택하세요."
              />
            )}
          </StepSection>

          <StepSection
            id="step-4"
            number="04"
            title="씬별 이미지 생성 및 영상 확인"
            stateLabel={
              renderedVideo
                ? "영상 완료"
                : productionAssets
                  ? "음성 있음"
                  : generatedImages.length
                    ? "이미지 있음"
                    : scriptResult
                      ? "준비됨"
                      : "대기"
            }
          >
            {scriptResult ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-[#fbfbfc] p-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-neutral-500">
                      Result
                    </p>
                    <p className="mt-1 text-lg font-black">
                      {imageProgress
                        ? `${imageProgress.total}개 씬 · ${imageProgress.completed}/${imageProgress.total} 생성 완료`
                        : `${scriptResult.scenes.length}개 씬 · Job ${scriptResult.jobId.slice(0, 8)}`}
                    </p>
                    {imageProgress ? (
                      <div className="mt-3 h-2 w-full max-w-72 overflow-hidden rounded-full bg-neutral-200">
                        <div
                          className="h-full rounded-full bg-[#183c38] transition-all"
                          style={{
                            width: `${Math.round(
                              (imageProgress.completed / imageProgress.total) * 100
                            )}%`
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton
                      onClick={exportMarkdown}
                      disabled={!scriptResult}
                      icon={Download}
                    >
                      MD
                    </SecondaryButton>
                    <SecondaryButton
                      onClick={exportJson}
                      disabled={!scriptResult}
                      icon={Download}
                    >
                      JSON
                    </SecondaryButton>
                    <PrimaryButton
                      onClick={handleGenerateImages}
                      disabled={isBusy}
                      loading={loading === "images"}
                      icon={Images}
                    >
                      {imageProgress
                        ? `${imageProgress.completed}/${imageProgress.total} 생성 중`
                        : "이미지 생성"}
                    </PrimaryButton>
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div>
                    <div className="mb-3 flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#e9f5f3] text-[#183c38]">
                        <Clapperboard className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-neutral-500">
                          Final Video
                        </p>
                        <h3 className="mt-1 text-lg font-black">
                          TTS 음성 · 자막 · 영상 패키지
                        </h3>
                      </div>
                    </div>

                    {productionAssets ? (
                      <div className="grid gap-3">
                        <audio
                          controls
                          src={productionAssets.audioUrl}
                          className="w-full"
                        />
                        <div className="grid gap-2 sm:grid-cols-3">
                          <AssetTile
                            icon={FileAudio}
                            label="Voiceover"
                            value={productionAssets.audioFileName}
                            onClick={() =>
                              downloadUrl(
                                productionAssets.audioFileName,
                                productionAssets.audioUrl
                              )
                            }
                          />
                          <AssetTile
                            icon={Captions}
                            label="VTT"
                            value={productionAssets.vttFileName}
                            onClick={() =>
                              downloadUrl(
                                productionAssets.vttFileName,
                                productionAssets.vttUrl
                              )
                            }
                          />
                          <AssetTile
                            icon={FileText}
                            label="SRT"
                            value={productionAssets.srtFileName}
                            onClick={() =>
                              downloadUrl(
                                productionAssets.srtFileName,
                                productionAssets.srtUrl
                              )
                            }
                          />
                        </div>
                        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-neutral-500">
                              Subtitles
                            </span>
                            <IconButton
                              label={copiedKey === "srt" ? "복사됨" : "SRT 복사"}
                              icon={Copy}
                              onClick={() => copyText("srt", productionAssets.srt)}
                            />
                          </div>
                          <div className="grid gap-2">
                            {productionAssets.captions.map((caption) => (
                              <div
                                key={caption.sceneIndex}
                                className="flex items-start gap-2 text-sm"
                              >
                                <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-black text-neutral-500">
                                  {caption.startSec}s
                                </span>
                                <p className="font-bold leading-6 text-neutral-800">
                                  {caption.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        icon={Mic2}
                        title="아직 음성과 자막이 없습니다"
                        text="스크립트를 바탕으로 TTS 음성과 SRT/VTT 자막을 생성하세요."
                      />
                    )}
                  </div>

                  <div className="grid gap-3">
                    <PrimaryButton
                      onClick={handleGenerateProductionAssets}
                      disabled={!scriptResult || isBusy}
                      loading={loading === "voiceover"}
                      icon={Mic2}
                    >
                      TTS·자막 생성
                    </PrimaryButton>
                    <SecondaryButton
                      onClick={handleRenderVideo}
                      disabled={!productionAssets || !hasAllImages || isBusy}
                      loading={loading === "video"}
                      icon={Clapperboard}
                    >
                      {videoProgress
                        ? `${videoProgress.percent}% 렌더링`
                        : "영상 렌더"}
                    </SecondaryButton>
                    {videoProgress ? (
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                        <div
                          className="h-full rounded-full bg-[#183c38] transition-all"
                          style={{ width: `${videoProgress.percent}%` }}
                        />
                      </div>
                    ) : null}
                    {!hasAllImages ? (
                      <p className="text-xs font-bold leading-5 text-neutral-500">
                        영상 렌더는 모든 씬 이미지가 준비되면 활성화됩니다.
                      </p>
                    ) : null}
                    {renderedVideo ? (
                      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                        <video
                          controls
                          src={renderedVideo.videoUrl}
                          className="aspect-[9/16] w-full rounded-md bg-black object-cover"
                        />
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-black text-neutral-500">
                            {formatBytes(renderedVideo.sizeBytes)} ·{" "}
                            {renderedVideo.mimeType.includes("mp4") ? "MP4" : "WEBM"}
                          </span>
                          <a
                            href={renderedVideo.videoUrl}
                            download={renderedVideo.fileName}
                            className="focus-ring inline-flex h-9 items-center gap-2 rounded-md bg-neutral-900 px-3 text-xs font-black text-white transition hover:bg-neutral-700"
                          >
                            <Download className="h-4 w-4" aria-hidden="true" />
                            영상 다운로드
                          </a>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {scriptResult.scenes.map((scene) => {
                    const image = imagesByScene.get(scene.index);
                    const isGeneratingScene = generatingSceneIndexes.has(scene.index);

                    return (
                      <article
                        key={scene.index}
                        className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
                      >
                        <div className="relative aspect-[9/16] w-full bg-neutral-100">
                          {image ? (
                            <NextImage
                              src={image.imageUrl}
                              alt={`Scene ${scene.index} generated visual`}
                              fill
                              sizes="(min-width: 1280px) 45vw, 100vw"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="grid h-full place-items-center p-6 text-center text-neutral-500">
                              <div>
                                {isGeneratingScene ? (
                                  <Loader2
                                    className="mx-auto h-10 w-10 animate-spin text-[#183c38]"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <ImageIcon
                                    className="mx-auto h-10 w-10"
                                    aria-hidden="true"
                                  />
                                )}
                                <p className="mt-3 text-sm font-black">
                                  {isGeneratingScene
                                    ? `Scene ${scene.index} 생성 중`
                                    : `Scene ${scene.index}`}
                                </p>
                                {isGeneratingScene ? (
                                  <p className="mt-1 text-xs font-bold text-neutral-400">
                                    완료되는 즉시 표시됩니다
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="mb-3 flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-neutral-500">
                                Scene {scene.index}
                              </p>
                              <h3 className="text-lg font-black leading-snug">
                                {scene.title}
                              </h3>
                            </div>
                            {image ? (
                              <a
                                href={image.imageUrl}
                                download={image.fileName}
                                className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-md bg-neutral-900 text-white transition hover:bg-neutral-700"
                                title="이미지 다운로드"
                                aria-label="이미지 다운로드"
                              >
                                <Download className="h-4 w-4" aria-hidden="true" />
                              </a>
                            ) : null}
                          </div>
                          <p className="text-sm font-bold leading-6 text-neutral-800">
                            {scene.narration}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <IconButton
                              label={
                                copiedKey === `caption-${scene.index}`
                                  ? "복사됨"
                                  : "자막 복사"
                              }
                              icon={Copy}
                              onClick={() =>
                                copyText(`caption-${scene.index}`, scene.caption)
                              }
                            />
                            <IconButton
                              label={
                                copiedKey === `image-prompt-${scene.index}`
                                  ? "복사됨"
                                  : "프롬프트 복사"
                              }
                              icon={Clipboard}
                              onClick={() =>
                                copyText(`image-prompt-${scene.index}`, scene.imagePrompt)
                              }
                            />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Images}
                title="스크립트가 없습니다"
                text="스크립트를 생성하면 씬별 이미지 작업이 열립니다."
              />
            )}
          </StepSection>
        </div>
      </div>
    </main>
  );
}

function StepSection({
  id,
  number,
  title,
  stateLabel,
  children
}: {
  id: string;
  number: string;
  title: string;
  stateLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-neutral-200 px-4 py-6 last:border-b-0 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-neutral-950 text-sm font-black text-white">
            {number}
          </span>
          <h2 className="text-xl font-black tracking-normal sm:text-2xl">{title}</h2>
        </div>
        <span className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-black text-neutral-600">
          {stateLabel}
        </span>
      </div>
      {children}
    </section>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  icon: Icon
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon: typeof Sparkles;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#183c38] px-4 text-sm font-black text-white transition hover:bg-[#245550] disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
  loading,
  icon: Icon
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon: typeof Sparkles;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-sm font-black text-neutral-900 transition hover:border-neutral-900 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick
}: {
  label: string;
  icon: typeof Copy;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-xs font-black text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-950"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function AssetTile({
  icon: Icon,
  label,
  value,
  onClick
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring flex min-h-20 items-center gap-3 rounded-md border border-neutral-200 bg-white p-3 text-left transition hover:border-neutral-900"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-neutral-100 text-neutral-700">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-black uppercase tracking-[0.12em] text-neutral-500">
          {label}
        </span>
        <span className="mt-1 block truncate text-sm font-black text-neutral-900">
          {value}
        </span>
      </span>
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text
}: {
  icon: typeof Sparkles;
  title: string;
  text: string;
}) {
  return (
    <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
      <div>
        <Icon className="mx-auto h-8 w-8 text-neutral-400" aria-hidden="true" />
        <h3 className="mt-3 text-base font-black text-neutral-800">{title}</h3>
        <p className="mt-1 text-sm font-semibold text-neutral-500">{text}</p>
      </div>
    </div>
  );
}
