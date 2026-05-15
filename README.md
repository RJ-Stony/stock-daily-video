# stock-daily-video

매일 아침 08:00 KST에 Notion 보유 종목을 읽어 Yahoo Finance로 시세·뉴스를 수집하고, Remotion으로 일일 영상(.mp4)을 렌더링한 뒤 카카오톡 "나에게 보내기"로 영상 링크를 보내는 자동 파이프라인입니다.

영상 디자인은 Apple 공식 사이트의 디자인 시스템(SF Pro / Action Blue / 라이트-다크 타일 교차)을 그대로 차용했습니다. 모든 디자인 토큰은 `src/styles/tokens.ts` 한 곳에 모여 있습니다.

## 요구사항

- Node.js 20 이상
- pnpm 9 이상 (`corepack enable` 후 `corepack prepare pnpm@9 --activate`)
- Notion Internal Integration API key + Portfolio DB 공유 권한

## 빠른 시작

```sh
cp .env.example .env       # 그리고 NOTION_API_KEY 채우기
pnpm install
pnpm notion                # Notion에서 종목 조회 smoke test
pnpm dev                   # Remotion Studio (브라우저 미리보기)
pnpm daily                 # 전체 파이프라인 1회 실행
```

> 첫 `pnpm dev` 실행 시 Remotion이 Chromium 약 150MB를 자동 다운로드합니다. 잠시 기다리세요.

## 환경변수

| 키 | 필수 | 설명 |
|---|---|---|
| `NOTION_API_KEY` | ✅ | Notion Internal Integration token (`ntn_...`) |
| `NOTION_PORTFOLIO_DB_ID` | ✅ | Portfolio DB의 Database ID |
| `GEMINI_API_KEY` | ✅ | Gemma 4 31B 한국어 인사이트 (Google AI Studio) |
| `GEMINI_MODEL` | ⏳ | 기본값 `gemma-4-31b-it`. 다른 모델 오버라이드 |
| `YOUTUBE_API_KEY` | ✅ | YouTube Data API v3 |
| `REDDIT_CLIENT_ID` | ⏳ | Reddit OAuth client id (script app). 미설정 시 Reddit 반응 수집 스킵 |
| `REDDIT_CLIENT_SECRET` | ⏳ | Reddit OAuth client secret. ID와 함께 설정해야 동작 |
| `KAKAO_REST_KEY` | ✅ | 카카오 앱 REST API 키 |
| `KAKAO_REFRESH_TOKEN` | ✅ | OAuth refresh token (60일 유효, 메시지 발송 시 자동 갱신) |
| `R2_ACCOUNT_ID` | ✅ | Cloudflare 계정 ID |
| `R2_ACCESS_KEY_ID` | ✅ | R2 API 토큰 access key |
| `R2_SECRET_ACCESS_KEY` | ✅ | R2 API 토큰 secret |
| `R2_BUCKET` | ✅ | R2 버킷 이름 |
| `R2_PUBLIC_BASE_URL` | ✅ | 버킷 public URL (예: `https://pub-xxxx.r2.dev`) |

✅ 현재 마일스톤 필수 / ⏳ 다음 마일스톤에서 사용

## 종목 추가

코드 수정 없이 **Notion DB에 행 한 줄 추가**만 하면 됩니다.

1. Notion `Investing` → `Portfolio` DB로 이동
2. **+ New** 클릭, 다음 컬럼 채우기:
   - `Name`: 표시명 (예: "엔비디아 (NVDA)")
   - `Ticker`: 표시용 티커
   - `Market`: `US` 또는 `KR`
   - `Yahoo Symbol`: Yahoo Finance 심볼 (한국 종목은 `.KS` / `.KQ` 접미사)
   - `Sector`: 섹터 multi-select
   - `Active`: ✅ 체크
3. 다음 실행(`pnpm daily` 또는 매일 08:00 Routine)에 자동 반영

비활성화는 `Active` 체크만 해제하면 됩니다.

## 디자인 변경

모든 색상·타이포·간격·라운드는 `src/styles/tokens.ts`에 토큰화되어 있습니다. Apple `DESIGN-apple.md` 사양에 따라 정의되어 있으며, 토큰 한 곳만 수정하면 모든 신(Intro / Holdings / Outro)에 즉시 반영됩니다. 인라인 hex는 사용하지 않습니다.

폰트는 SF Pro 대신 Inter (Google Fonts)를 사용합니다 — Linux 호환 + OSS 라이선스. letter-spacing은 SF Pro의 "tight" 느낌을 재현하기 위해 -0.01em 추가 보정되어 있습니다.

## Cloudflare R2 발급

영상과 썸네일을 호스팅할 무료 스토리지(월 10GB까지 무료).

1. [dash.cloudflare.com](https://dash.cloudflare.com) 가입/로그인
2. 좌측 **R2** → **Create bucket** → 이름 입력 (예: `stock-daily-video`) → `R2_BUCKET`에 저장
3. 생성된 bucket → **Settings** → **Public Access** → **R2.dev subdomain 활성화**
   - ⚠️ Bucket이 비공개면 카카오톡에서 영상이 열리지 않습니다
   - `R2_PUBLIC_BASE_URL = https://pub-{hash}.r2.dev` (활성화 후 표시되는 URL)
4. 좌측 R2 → **Manage R2 API Tokens** → **Create API Token**
   - 권한: **Object Read & Write**
   - Specify bucket: 위에서 만든 bucket 선택
5. 발급된 값:
   - **Access Key ID** → `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → `R2_SECRET_ACCESS_KEY`
   - 우상단 Cloudflare **Account ID** → `R2_ACCOUNT_ID`

## 카카오톡 OAuth 토큰 발급

"나에게 보내기" API 사용을 위한 1회 발급. 가장 까다로운 단계.

1. [developers.kakao.com](https://developers.kakao.com) → **내 애플리케이션** → **애플리케이션 추가하기**
2. 앱 키 페이지에서 **REST API 키** 복사 → `KAKAO_REST_KEY`
3. **플랫폼** → **Web 플랫폼 등록** → 사이트 도메인 `http://localhost:3000` 입력
4. **카카오 로그인** → 활성화 ON, **Redirect URI**: `http://localhost:3000/oauth`
5. **동의항목** → **카카오톡 메시지 전송 (`talk_message`)** 사용 설정 (선택 동의)
6. 브라우저에서 다음 URL 직접 호출 (`{REST_KEY}` 본인 값으로 치환):
   ```
   https://kauth.kakao.com/oauth/authorize?response_type=code&client_id={REST_KEY}&redirect_uri=http://localhost:3000/oauth&scope=talk_message
   ```
7. 인증 후 redirect된 URL의 `?code=...` 값 복사 (페이지가 안 떠도 OK — URL바만 보면 됨)
8. 터미널에서 토큰 교환 (`{REST_KEY}` / `{CODE}` 치환):
   ```sh
   curl -X POST "https://kauth.kakao.com/oauth/token" \
     -d "grant_type=authorization_code" \
     -d "client_id={REST_KEY}" \
     -d "redirect_uri=http://localhost:3000/oauth" \
     -d "code={CODE}"
   ```
9. 응답 JSON의 `refresh_token` 값 → `KAKAO_REFRESH_TOKEN`
   - 유효기간 약 60일. 매일 메시지 발송하면 자동으로 갱신됩니다
   - 60일 이상 미발송 시 6~9단계 재실행 필요

## Claude Code Routine 등록

매일 KST 08:00 자동 실행 (미국장 마감 후 약 3시간).

1. GitHub repo 생성 후 이 프로젝트 push
2. [claude.ai/code/routines](https://claude.ai/code/routines) → **New routine**
3. 저장소: 위에서 만든 GitHub repo 선택
4. 환경 setup script (Anthropic 클라우드에 chromium 사전 설치 필요):
   ```sh
   apt-get update && apt-get install -y chromium ffmpeg && pnpm install
   ```
5. 환경변수: 위 표의 ✅ 표시된 키 **전부**
6. 트리거 → **스케줄** → cron `0 8 * * *` (Asia/Seoul, KST 08:00 매일, 약 5–15분 stagger jitter 있음)
7. 지시문 예: `pnpm daily 실행. 실패 시 로그 분석 후 fix PR 작성.`

> 미국 정규장 마감: 서머타임 한국 05:00 / 표준시 한국 06:00. 08:00은 마감 후 2~3시간 정리된 데이터를 받기 좋은 시각.

## 마일스톤 2 — 분석 발표 자료

종목당 5개 씬(sequence)으로 구성된 분석 발표 영상을 생성합니다.

| 씬 | 내용 | 배경 |
|---|---|---|
| A — 가격 | 현재가 / 등락률 / 스파크라인 | 라이트 |
| B — 헤드라인 | 주요 뉴스 3건 | 파치먼트 |
| C — Why | Gemma 4 31B 한국어 인사이트 (원인 분석) | 다크 |
| D — 영상 | 관련 YouTube 영상 썸네일 | 라이트 |
| E — 반응 | YouTube 영상 시청자 댓글 상위 5건 | 다크 |

**데이터 소스**: Gemma 4 31B (Google AI Studio) / Yahoo + Google News RSS / YouTube Data API v3 (영상 + 댓글)

**캐시**: `out/cache/{date}.json` — 동일 날짜 재실행 시 자동 사용 (fetch 0회, 렌더만 재실행)

**소요 시간**: 종목당 약 49초 × 10종목 = 약 8분 17초

## 다음 마일스톤 TODO

- [x] **분석 발표 자료** (마일스톤 2) — 완료
- [x] **R2 업로드** (마일스톤 3) — 완료
- [x] **카카오 알림** (마일스톤 3) — 완료
- [ ] **YouTube Shorts** — 세로 9:16 컴포지션 추가 + Data API 업로드
- [ ] **거래량/배당** — Yahoo `quoteSummary` 모듈 호출 추가

## 라이선스

내부 개인 프로젝트.
