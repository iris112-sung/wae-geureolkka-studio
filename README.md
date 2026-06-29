# 왜그럴까 스튜디오

일상 심리, 인간관계, 소비 습관을 다루는 유튜브 숏츠 제작 워크플로우 MVP입니다.

## 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

로컬에서 AI 비용 없이 전체 플로우를 확인하려면 `.env.local`에서 `USE_MOCK_AI=true`로 설정합니다.

## Vercel 환경변수

Vercel 프로젝트에는 다음 환경변수를 설정합니다.

```env
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=gpt-5.5
OPENAI_IMAGE_MODEL=gpt-image-2
USE_MOCK_AI=false
```

로컬 개발에서는 생성 이미지를 `/public/generated/{jobId}/scene-{index}.png`에 저장합니다. Vercel 서버리스 런타임은 런타임 파일 영구 저장을 지원하지 않으므로, 배포 환경에서는 미리보기용 inline 이미지 URL을 반환합니다. 실제 운영에서는 `lib/storage/images.ts`를 S3, Supabase Storage, Vercel Blob 같은 영구 스토리지 구현으로 교체하면 됩니다.

## 배포

```bash
npx vercel@latest login
npx vercel@latest --prod --yes
```

현재 로컬 환경에서 Vercel CLI 실행은 가능하지만, 저장된 Vercel 토큰이 유효하지 않아 배포가 인증 단계에서 중단될 수 있습니다. 이 경우 `vercel login`으로 다시 로그인한 뒤 배포 명령을 실행합니다.
