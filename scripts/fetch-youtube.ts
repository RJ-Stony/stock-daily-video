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

async function searchOnce(apiKey: string, query: string, publishedAfter: string): Promise<SearchHit[]> {
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
    console.warn(`[youtube] search "${query}" HTTP ${res.status}`);
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

async function fetchVideoDetails(apiKey: string, videoIds: string[]): Promise<Map<string, { durationSec: number; viewCount?: number }>> {
  const out = new Map<string, { durationSec: number; viewCount?: number }>();
  if (videoIds.length === 0) return out;

  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'contentDetails,statistics');
  url.searchParams.set('id', videoIds.join(','));
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn(`[youtube] details HTTP ${res.status}`);
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

  for (const h of holdings) {
    try {
      // 검색어: KR 종목은 한국어만 / US 종목은 한국어+영어
      const queries = h.market === 'KR'
        ? [`${h.name} 주가 분석`]
        : [`${h.name} 주가 분석`, `${h.ticker} stock analysis`];

      // 순차 호출(quota 절약). 결과를 videoId 기준 dedupe
      const hitsByVid = new Map<string, SearchHit>();
      for (const q of queries) {
        const hits = await searchOnce(apiKey, q, publishedAfter);
        for (const hit of hits) {
          if (!hitsByVid.has(hit.videoId)) hitsByVid.set(hit.videoId, hit);
        }
      }

      const ids = Array.from(hitsByVid.keys());
      const details = await fetchVideoDetails(apiKey, ids);

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

  return out;
}
