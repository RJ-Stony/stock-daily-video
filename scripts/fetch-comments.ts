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

const PER_VIDEO = 5;
const PER_HOLDING = 5;
const MAX_TEXT = 320;

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
  count = PER_VIDEO,
): Promise<Comment[]> {
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
      console.warn(`[comments] ${ticker}/${video.videoId} HTTP ${res.status}`);
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

    try {
      const settled = await Promise.allSettled(
        videos.map(v => fetchVideoComments(apiKey, h.ticker, v, PER_VIDEO)),
      );
      const merged: Comment[] = settled.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
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

  return out;
}
