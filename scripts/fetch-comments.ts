import 'dotenv/config';
import type { Comment, HoldingWithData, YouTubeVideo } from '../src/types';

interface CommentThreadsResponse {
  items?: Array<{
    snippet?: {
      topLevelComment?: {
        snippet?: {
          textOriginal?: string;
          textDisplay?: string;
          authorDisplayName?: string;
          likeCount?: number;
          publishedAt?: string;
        };
      };
    };
  }>;
}

interface ApiErrorResponse {
  error?: {
    code?: number;
    errors?: Array<{ reason?: string }>;
  };
}

const QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded']);

function parseQuotaReason(bodyText: string): string | null {
  try {
    const json = JSON.parse(bodyText) as ApiErrorResponse;
    const reason = json.error?.errors?.[0]?.reason;
    if (reason && QUOTA_REASONS.has(reason)) return reason;
  } catch { /* not JSON */ }
  return null;
}

const PER_VIDEO = 5;
const PER_HOLDING = 5;
const MAX_TEXT = 320;

interface QuotaState {
  exhausted: boolean;
}

function clean(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT);
}

async function fetchVideoComments(
  apiKey: string,
  ticker: string,
  video: YouTubeVideo,
  quota: QuotaState,
  count = PER_VIDEO,
): Promise<Comment[]> {
  if (quota.exhausted) return [];

  const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('videoId', video.videoId);
  url.searchParams.set('order', 'relevance');
  url.searchParams.set('maxResults', String(count));
  url.searchParams.set('textFormat', 'plainText');
  url.searchParams.set('key', apiKey);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.text();
      const quotaReason = parseQuotaReason(body);
      if (quotaReason) {
        console.warn(`[comments] quota 초과 감지 (${quotaReason}) — 이후 모든 댓글 호출 스킵`);
        quota.exhausted = true;
      } else {
        // 댓글 비활성 영상은 403, 비공개 영상은 404 등 — 한 영상 실패는 치명적이지 않음
        console.warn(`[comments] ${ticker}/${video.videoId} HTTP ${res.status} body=${body.slice(0, 120)}`);
      }
      return [];
    }
    const json = (await res.json()) as CommentThreadsResponse;
    const out: Comment[] = [];
    for (const item of json.items ?? []) {
      const sn = item.snippet?.topLevelComment?.snippet;
      if (!sn) continue;
      const rawText = sn.textOriginal ?? sn.textDisplay ?? '';
      const text = clean(rawText);
      if (!text || text.length < 10) continue;
      if (!sn.authorDisplayName || !sn.publishedAt) continue;
      out.push({
        ticker,
        source: 'youtube',
        channel: video.channel,
        videoTitle: video.title,
        videoId: video.videoId,
        author: sn.authorDisplayName,
        text,
        likeCount: typeof sn.likeCount === 'number' ? sn.likeCount : 0,
        publishedAt: sn.publishedAt,
      });
    }
    return out;
  } catch (err) {
    console.warn(`[comments] ${ticker}/${video.videoId} 실패`, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchCommentsBatch(
  holdings: HoldingWithData[],
  videosByYahooSymbol: Record<string, YouTubeVideo[]>,
): Promise<Record<string, Comment[]>> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const out: Record<string, Comment[]> = {};

  if (!apiKey) {
    console.warn('[comments] YOUTUBE_API_KEY 없음 — 댓글 스킵');
    for (const h of holdings) out[h.yahooSymbol] = [];
    return out;
  }

  const quota: QuotaState = { exhausted: false };

  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i];
    const videos = (videosByYahooSymbol[h.yahooSymbol] ?? []).slice(0, 3);
    process.stdout.write(`[comments] (${i + 1}/${holdings.length}) ${h.ticker} (영상 ${videos.length}개) 댓글 수집 중... `);
    const t0 = Date.now();

    if (videos.length === 0) {
      console.log('영상 0개 — 스킵');
      out[h.yahooSymbol] = [];
      continue;
    }

    if (quota.exhausted) {
      console.log('quota 초과 — 스킵');
      out[h.yahooSymbol] = [];
      continue;
    }

    try {
      // 순차 호출 — 첫 영상에서 quota 끊기면 즉시 stop, 같은 종목 다른 영상도 안 부름.
      // 특정 영상이 댓글을 독점하지 않도록 영상당 채택 한도(perVideoCap)를 둔다.
      // 영상 수에 따라 동적으로 결정해 PER_HOLDING은 항상 채울 수 있게 한다.
      const perVideoCap = Math.max(2, Math.ceil(PER_HOLDING / Math.max(1, videos.length)));
      const merged: Comment[] = [];
      for (const v of videos) {
        if (quota.exhausted) break;
        const got = await fetchVideoComments(apiKey, h.ticker, v, quota, PER_VIDEO);
        got.sort((a, b) => b.likeCount - a.likeCount);
        merged.push(...got.slice(0, perVideoCap));
      }
      merged.sort((a, b) => b.likeCount - a.likeCount);
      const selected = merged.slice(0, PER_HOLDING);
      out[h.yahooSymbol] = selected;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`${selected.length}건 (${elapsed}s)`);
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`실패 (${elapsed}s) — ${err instanceof Error ? err.message : err}`);
      out[h.yahooSymbol] = [];
    }
  }

  if (quota.exhausted) {
    console.warn('[comments] 일일 quota 초과로 일부/전체 종목의 댓글이 비었습니다.');
  }

  return out;
}
