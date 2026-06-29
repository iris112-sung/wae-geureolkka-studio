import type { CaptionCue, GeneratedImage, Scene } from "@/lib/schemas";

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 1280;
const CANVAS_FPS = 30;

export type VideoRenderProgress = {
  phase: "preparing" | "recording" | "finalizing";
  percent: number;
};

export type RenderedVideoAsset = {
  videoUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

type RenderShortsVideoParams = {
  jobId: string;
  title: string;
  scenes: Scene[];
  images: GeneratedImage[];
  captions: CaptionCue[];
  audioUrl: string;
  plannedDurationSec: number;
  onProgress?: (progress: VideoRenderProgress) => void;
};

function getSupportedMimeType() {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

function getExtension(mimeType: string) {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("영상 렌더링용 이미지를 불러오지 못했습니다."));
    image.src = src;
  });
}

function waitForAudioReady(audio: HTMLAudioElement) {
  return new Promise<void>((resolve, reject) => {
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      resolve();
      return;
    }

    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", handleReady);
      audio.removeEventListener("canplaythrough", handleReady);
      audio.removeEventListener("error", handleError);
    };
    const handleReady = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("TTS 음성 파일을 불러오지 못했습니다."));
    };

    audio.addEventListener("loadedmetadata", handleReady);
    audio.addEventListener("canplaythrough", handleReady);
    audio.addEventListener("error", handleError);
  });
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number
) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = width / height;
  const drawHeight = imageRatio > canvasRatio ? height : width / imageRatio;
  const drawWidth = imageRatio > canvasRatio ? height * imageRatio : width;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;

  context.drawImage(image, x, y, drawWidth, drawHeight);
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  const pushByCharacter = (value: string) => {
    let line = "";
    for (const character of value) {
      const nextLine = `${line}${character}`;
      if (line && context.measureText(nextLine).width > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = nextLine;
      }
    }
    if (line) lines.push(line);
  };

  for (const word of words.length ? words : [text]) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = "";
    }

    if (context.measureText(word).width > maxWidth) {
      pushByCharacter(word);
    } else {
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 3);
}

function drawCaption(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number
) {
  const maxWidth = width - 96;
  const fontSize = 46;
  const lineHeight = 62;

  context.save();
  context.font = `800 ${fontSize}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const lines = wrapText(context, text, maxWidth);
  const blockHeight = lines.length * lineHeight + 48;
  const boxWidth =
    Math.min(
      maxWidth + 32,
      Math.max(...lines.map((line) => context.measureText(line).width), 260) + 72
    ) || 360;
  const boxX = (width - boxWidth) / 2;
  const boxY = height - blockHeight - 98;

  context.fillStyle = "rgba(0, 0, 0, 0.54)";
  context.beginPath();
  context.roundRect(boxX, boxY, boxWidth, blockHeight, 24);
  context.fill();

  context.fillStyle = "#ffffff";
  context.shadowColor = "rgba(0, 0, 0, 0.55)";
  context.shadowBlur = 10;
  context.shadowOffsetY = 3;
  lines.forEach((line, index) => {
    const y =
      boxY + 24 + lineHeight / 2 + index * lineHeight + (lines.length === 1 ? 2 : 0);
    context.fillText(line, width / 2, y, maxWidth);
  });
  context.restore();
}

function drawTopLabel(
  context: CanvasRenderingContext2D,
  title: string,
  scene: Scene,
  width: number
) {
  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.42)";
  context.beginPath();
  context.roundRect(42, 42, width - 84, 92, 22);
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = "800 27px Arial, sans-serif";
  context.textAlign = "left";
  context.fillText(title.slice(0, 28), 70, 82, width - 140);
  context.font = "700 21px Arial, sans-serif";
  context.fillStyle = "rgba(255, 255, 255, 0.82)";
  context.fillText(`Scene ${scene.index}. ${scene.title}`.slice(0, 42), 70, 114, width - 140);
  context.restore();
}

function drawGradient(context: CanvasRenderingContext2D, width: number, height: number) {
  const topGradient = context.createLinearGradient(0, 0, 0, 320);
  topGradient.addColorStop(0, "rgba(0, 0, 0, 0.42)");
  topGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = topGradient;
  context.fillRect(0, 0, width, 320);

  const bottomGradient = context.createLinearGradient(0, height - 520, 0, height);
  bottomGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  bottomGradient.addColorStop(1, "rgba(0, 0, 0, 0.64)");
  context.fillStyle = bottomGradient;
  context.fillRect(0, height - 520, width, 520);
}

function findCue(captions: CaptionCue[], timelineSec: number) {
  return (
    captions.find(
      (caption) => timelineSec >= caption.startSec && timelineSec < caption.endSec
    ) ?? captions[captions.length - 1]
  );
}

function waitForEnded(audio: HTMLAudioElement, fallbackMs: number) {
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, fallbackMs);
    audio.addEventListener(
      "ended",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

export async function renderShortsVideo({
  jobId,
  title,
  scenes,
  images,
  captions,
  audioUrl,
  plannedDurationSec,
  onProgress
}: RenderShortsVideoParams): Promise<RenderedVideoAsset> {
  if (!("MediaRecorder" in window)) {
    throw new Error("현재 브라우저에서 영상 렌더링을 지원하지 않습니다. Chrome에서 다시 시도해 주세요.");
  }

  const mimeType = getSupportedMimeType();
  if (!mimeType) {
    throw new Error("현재 브라우저에서 저장 가능한 영상 포맷을 찾지 못했습니다.");
  }

  onProgress?.({ phase: "preparing", percent: 5 });

  const imageMap = new Map(images.map((image) => [image.sceneIndex, image]));
  const loadedImages = await Promise.all(
    scenes.map(async (scene) => {
      const image = imageMap.get(scene.index);
      if (!image) {
        throw new Error(`Scene ${scene.index} 이미지가 필요합니다.`);
      }
      return {
        scene,
        image: await loadImage(image.imageUrl)
      };
    })
  );

  const audio = new Audio(audioUrl);
  audio.preload = "auto";
  audio.crossOrigin = "anonymous";
  await waitForAudioReady(audio);
  onProgress?.({ phase: "preparing", percent: 20 });

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("영상 렌더링 캔버스를 만들지 못했습니다.");
  }

  const audioContext = new AudioContext();
  const sourceNode = audioContext.createMediaElementSource(audio);
  const destinationNode = audioContext.createMediaStreamDestination();
  sourceNode.connect(destinationNode);

  const canvasStream = canvas.captureStream(CANVAS_FPS);
  const stream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...destinationNode.stream.getAudioTracks()
  ]);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 5_000_000,
    audioBitsPerSecond: 128_000
  });
  const audioDurationSec = Number.isFinite(audio.duration)
    ? audio.duration
    : plannedDurationSec;
  const durationScale =
    audioDurationSec > 0 ? plannedDurationSec / audioDurationSec : 1;

  const stopRecording = new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    recorder.addEventListener("error", () => {
      reject(new Error("영상 녹화 중 오류가 발생했습니다."));
    });
    recorder.addEventListener("stop", () => {
      resolve(new Blob(chunks, { type: mimeType }));
    });
  });

  const drawFrame = () => {
    const audioTimeSec = Math.min(audio.currentTime, audioDurationSec);
    const timelineSec = Math.min(audioTimeSec * durationScale, plannedDurationSec);
    const cue = findCue(captions, timelineSec);
    const frame =
      loadedImages.find(({ scene }) => scene.index === cue.sceneIndex) ??
      loadedImages[loadedImages.length - 1];

    drawCover(context, frame.image, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawGradient(context, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawTopLabel(context, title, frame.scene, CANVAS_WIDTH);
    drawCaption(context, cue.text, CANVAS_WIDTH, CANVAS_HEIGHT);

    const percent = Math.min(
      98,
      Math.max(20, Math.round((audioTimeSec / audioDurationSec) * 100))
    );
    onProgress?.({ phase: "recording", percent });

    if (!audio.ended && recorder.state === "recording") {
      window.requestAnimationFrame(drawFrame);
    }
  };

  try {
    recorder.start(500);
    await audioContext.resume();
    await audio.play();
    drawFrame();
    await waitForEnded(audio, Math.ceil((audioDurationSec + 1) * 1000));
    onProgress?.({ phase: "finalizing", percent: 99 });

    if (recorder.state !== "inactive") {
      recorder.stop();
    }

    const blob = await stopRecording;
    const extension = getExtension(mimeType);

    return {
      videoUrl: URL.createObjectURL(blob),
      fileName: `${jobId}-wae-geureolkka.${extension}`,
      mimeType,
      sizeBytes: blob.size
    };
  } finally {
    audio.pause();
    stream.getTracks().forEach((track) => track.stop());
    sourceNode.disconnect();
    await audioContext.close().catch(() => undefined);
  }
}
