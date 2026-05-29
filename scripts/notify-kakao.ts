import 'dotenv/config';
import { setTimeout as sleep } from 'node:timers/promises';

interface TokenResponse {
  access_token: string;
}

// 카카오 인증서가 자정(UTC) 전후로 미리 갱신돼 notBefore 가 미래로 잡히거나(이슈 #5),
// 컨테이너 시계가 수 분 뒤처졌을 때 TLS 핸드셰이크가 CERT_NOT_YET_VALID 로 실패한다.
// 일시적 네트워크 오류(ECONNRESET 등)도 포함해, 잠시 기다렸다 재시도하면 대개 회복된다.
const RETRYABLE_CODES = new Set([
  'CERT_NOT_YET_VALID',
  'CERT_HAS_EXPIRED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

// notBefore 가 자정(UTC) 직후로 잡힌 경우를 어느 정도 흡수하도록 점증 대기.
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000];

function retryableReason(err: unknown): string | null {
  if (!(err instanceof Error)) return null;
  const self = err as NodeJS.ErrnoException;
  const cause = (err as { cause?: NodeJS.ErrnoException }).cause;
  const code = self.code ?? cause?.code;
  if (code && RETRYABLE_CODES.has(code)) return code;
  // fetch 는 원인을 cause 에만 담고 자신은 'fetch failed' 만 던질 때가 있다.
  const haystack = `${err.message} ${cause?.message ?? ''}`;
  if (/certificate is not yet valid|CERT_NOT_YET_VALID/i.test(haystack)) return 'CERT_NOT_YET_VALID';
  return null;
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

  // refresh(token) 와 send 둘 다 kakao 도메인의 TLS 를 거치므로 한 단위로 묶어 재시도한다.
  const attempt = async (): Promise<void> => {
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
  };

  const maxAttempts = RETRY_DELAYS_MS.length + 1;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await attempt();
      console.log('[notify-kakao] sent', { date, videoUrl, attempt: i + 1 });
      return;
    } catch (err) {
      const reason = retryableReason(err);
      const cause = err instanceof Error ? (err as NodeJS.ErrnoException & { cause?: unknown }).cause : undefined;

      // 재시도 불가 오류(HTTP 4xx 등)거나 마지막 시도면 실패 확정.
      if (!reason || i === maxAttempts - 1) {
        console.error('[notify-kakao] 실패', err instanceof Error ? err.message : err, cause ? cause : '');
        return;
      }

      const waitMs = RETRY_DELAYS_MS[i];
      console.warn(
        `[notify-kakao] ${reason} — ${waitMs / 1000}s 후 재시도 (${i + 1}/${maxAttempts - 1})`,
      );
      await sleep(waitMs);
    }
  }
}
