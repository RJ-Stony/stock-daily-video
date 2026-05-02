import 'dotenv/config';
import type { HoldingWithData, YouTubeVideo } from '../src/types';

interface SearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
}

interface VideosResponse {
  items?: Array<{
    id?: string;
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string };
  }>;
}

interface ApiErrorResponse {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string }>;
    status?: string;
  };
}

// search.list 1회 = 100 quota units, videos.list 1회 = 1 unit.
// 일일 기본 quota 10,000 units → search 만 100번 가능. 종목당 2번 search 면 50종목/일.
// 따라서 quotaExceeded 가 한 번 발생하면 같은 키로 이후 호출은 무의미 — 즉시 abort.
const QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded']);

function parseQuotaReason(bodyText: string): string | null {
  try {
    const json = JSON.parse(bodyText) as ApiErrorResponse;
    const reason = json.error?.errors?.[0]?.reason;
    if (reason && QUOTA_REASONS.has(reason)) return reason;
  } catch { /* not JSON */ }
  return null;
}

// ISO 8601 duration "PT#H#M#S" → seconds
function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? '0', 10);
  const min = parseInt(m[2] ?? '0', 10);
  const s = parseInt(m[3] ?? '0', 10);
  return h * 3600 + min * 60 + s;
}

interface SearchHit {
  videoId: string;
  title: string;
  channel: string;
  publishedAt: string;
  thumbnailUrl: string;
}

interface QuotaState {
  exhausted: boolean;
}

async function searchOnce(apiKey: string, query: string, publishedAfter: string, quota: QuotaState): Promise<SearchHit[]> {
  if (quota.exhausted) return [];

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', '10');
  url.searchParams.set('videoDuration', 'medium');
  url.searchParams.set('order', 'relevance');
  url.searchParams.set('publishedAfter', publishedAfter);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    const quotaReason = parseQuotaReason(body);
    if (quotaReason) {
      console.warn(`[youtube] quota 초과 감지 (${quotaReason}) — 이후 모든 YouTube 호출 스킵`);
      quota.exhausted = true;
    } else {
      console.warn(`[youtube] search "${query}" HTTP ${res.status} body=${body.slice(0, 200)}`);
    }
    return [];
  }
  const json = (await res.json()) as SearchResponse;
  const hits: SearchHit[] = [];
  for (const it of json.items ?? []) {
    const videoId = it.id?.videoId;
    const sn = it.snippet;
    if (!videoId || !sn?.title || !sn.channelTitle || !sn.publishedAt) continue;
    const thumbs = sn.thumbnails;
    const thumbnailUrl = thumbs?.high?.url ?? thumbs?.medium?.url ?? thumbs?.default?.url ?? '';
    if (!thumbnailUrl) continue;
    hits.push({
      videoId,
      title: sn.title,
      channel: sn.channelTitle,
      publishedAt: sn.publishedAt,
      thumbnailUrl,
    });
  }
  return hits;
}

async function fetchVideoDetails(apiKey: string, videoIds: string[], quota: QuotaState): Promise<Map<string, { durationSec: number; viewCount?: number }>> {
  const out = new Map<string, { durationSec: number; viewCount?: number }>();
  if (videoIds.length === 0 || quota.exhausted) return out;

  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'contentDetails,statistics');
  url.searchParams.set('id', videoIds.join(','));
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    const quotaReason = parseQuotaReason(body);
    if (quotaReason) {
      console.warn(`[youtube] quota 초과 감지 (${quotaReason}) — videos.list 단계`);
      quota.exhausted = true;
    } else {
      console.warn(`[youtube] details HTTP ${res.status} body=${body.slice(0, 200)}`);
    }
    return out;
  }
  const json = (await res.json()) as VideosResponse;
  for (const it of json.items ?? []) {
    if (!it.id) continue;
    const durationSec = it.contentDetails?.duration ? parseDuration(it.contentDetails.duration) : 0;
    const viewCountRaw = it.statistics?.viewCount;
    const viewCount = viewCountRaw ? parseInt(viewCountRaw, 10) : undefined;
    out.set(it.id, { durationSec, viewCount });
  }
  return out;
}

const MIN_HITS_BEFORE_FALLBACK = 3;

export async function fetchYouTubeBatch(
  holdings: HoldingWithData[],
): Promise<Record<string, YouTubeVideo[]>> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const out: Record<string, YouTubeVideo[]> = {};

  if (!apiKey) {
    console.warn('[youtube] YOUTUBE_API_KEY 없음 — 스킵');
    for (const h of holdings) out[h.yahooSymbol] = [];
    return out;
  }

  const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const quota: QuotaState = { exhausted: false };

  for (const h of holdings) {
    if (quota.exhausted) {
      out[h.yahooSymbol] = [];
      continue;
    }

    try {
      // quota 절감 전략: 한국어 검색을 먼저 돌리고, 결과가 충분하면 영어 fallback 생략.
      // search.list = 100 units → 한 종목당 1번만 호출하면 일일 100종목 처리 가능.
      const primaryQuery = `${h.name} 주가 분석`;
      const fallbackQuery = h.market === 'KR' ? null : `${h.ticker} stock analysis`;

      const hitsByVid = new Map<string, SearchHit>();
      const primaryHits = await searchOnce(apiKey, primaryQuery, publishedAfter, quota);
      for (const hit of primaryHits) hitsByVid.set(hit.videoId, hit);

      if (
        !quota.exhausted &&
        fallbackQuery &&
        hitsByVid.size < MIN_HITS_BEFORE_FALLBACK
      ) {
        const fallbackHits = await searchOnce(apiKey, fallbackQuery, publishedAfter, quota);
        for (const hit of fallbackHits) {
          if (!hitsByVid.has(hit.videoId)) hitsByVid.set(hit.videoId, hit);
        }
      }

      const ids = Array.from(hitsByVid.keys());
      const details = await fetchVideoDetails(apiKey, ids, quota);

      // 5~30분 필터 + 첫 3개
      const filtered: YouTubeVideo[] = [];
      for (const hit of hitsByVid.values()) {
        const det = details.get(hit.videoId);
        if (!det || det.durationSec < 300 || det.durationSec > 1800) continue;
        filtered.push({
          ticker: h.ticker,
          videoId: hit.videoId,
          title: hit.title,
          channel: hit.channel,
          thumbnailUrl: hit.thumbnailUrl,
          publishedAt: hit.publishedAt,
          viewCount: det.viewCount,
          durationSec: det.durationSec,
        });
        if (filtered.length >= 3) break;
      }

      out[h.yahooSymbol] = filtered;
    } catch (err) {
      console.warn(`[youtube] ${h.ticker} 실패`, err instanceof Error ? err.message : err);
      out[h.yahooSymbol] = [];
    }
  }

  if (quota.exhausted) {
    console.warn('[youtube] 일일 quota 초과로 일부/전체 종목의 영상이 비었습니다. Google Cloud Console 에서 quota 증설을 신청하거나 다음 날까지 기다려주세요.');
  }

  return out;
}
