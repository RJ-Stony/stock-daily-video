import 'dotenv/config';

interface TokenResponse {
  access_token: string;
}

/**
 * refresh_token으로 access_token을 갱신한다.
 * 실패 시 throw (호출부에서 catch).
 */
async function refreshAccessToken(restKey: string, refreshToken: string): Promise<string> {
  const params: Record<string, string> = {
    grant_type: 'refresh_token',
    client_id: restKey,
    refresh_token: refreshToken,
  };
  // Client Secret이 활성화된 앱이면 함께 전송 (활성화 안 했으면 KAKAO_CLIENT_SECRET 비워두면 됨)
  const clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim();
  if (clientSecret) {
    params.client_secret = clientSecret;
  }
  const body = new URLSearchParams(params);

  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[notify-kakao] token refresh 실패 ${res.status}: ${text}`);
  }

  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) {
    throw new Error('[notify-kakao] access_token 응답 누락');
  }
  return json.access_token;
}

/**
 * 카카오톡 "나에게 보내기" 발송 — feed 템플릿(이미지 + 제목 + 설명 + 버튼).
 *
 * @param videoUrl mp4 영상의 public URL (R2)
 * @param thumbnailUrl 썸네일 jpg public URL
 * @param summary 본문 요약 ("N종목 평균 X.XX% (↑a ↓b)")
 * @param date YYYY-MM-DD (메시지 제목용)
 *
 * 환경변수 누락 시 graceful degrade — console.warn 후 return.
 */
export async function sendKakaoMessage(
  videoUrl: string,
  thumbnailUrl: string,
  summary: string,
  date: string,
): Promise<void> {
  const restKey = process.env.KAKAO_REST_KEY?.trim();
  const refreshToken = process.env.KAKAO_REFRESH_TOKEN?.trim();

  if (!restKey || !refreshToken) {
    console.warn('[notify-kakao] KAKAO_REST_KEY / KAKAO_REFRESH_TOKEN 미설정 — 발송 스킵', {
      videoUrl,
      thumbnailUrl,
      summary,
    });
    return;
  }

  const RETRY_DELAY_MS = 30_000;
  const CERT_NOT_YET_VALID = 'CERT_NOT_YET_VALID';

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const accessToken = await refreshAccessToken(restKey, refreshToken);

      const template = {
        object_type: 'feed',
        content: {
          title: `${date} 일일 시황`,
          description: summary,
          image_url: thumbnailUrl,
          link: { web_url: videoUrl, mobile_web_url: videoUrl },
        },
        buttons: [
          { title: '영상 보기', link: { web_url: videoUrl, mobile_web_url: videoUrl } },
        ],
      };

      const body = new URLSearchParams({ template_object: JSON.stringify(template) });

      const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`[notify-kakao] 발송 실패 ${res.status}: ${text}`);
      }

      console.log('[notify-kakao] sent', { date, videoUrl });
      return;
    } catch (err) {
      const code = err instanceof Error ? (err as NodeJS.ErrnoException & { cause?: NodeJS.ErrnoException }).cause?.code : undefined;
      const isCertNotYetValid = code === CERT_NOT_YET_VALID;

      if (isCertNotYetValid && attempt === 1) {
        console.warn(`[notify-kakao] ${CERT_NOT_YET_VALID} — ${RETRY_DELAY_MS / 1000}초 후 재시도`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }

      const cause = err instanceof Error ? (err as NodeJS.ErrnoException & { cause?: unknown }).cause : undefined;
      console.error('[notify-kakao] 실패', err instanceof Error ? err.message : err, cause ? cause : '');
    }
  }
}
