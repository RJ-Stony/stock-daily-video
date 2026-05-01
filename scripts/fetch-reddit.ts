import 'dotenv/config';
import type { HoldingWithData, RedditPost } from '../src/types';

// 종목 → subreddit 화이트리스트 매핑. 미정의 ticker는 ['stocks'] 기본.
const TICKER_TO_SUBREDDITS: Record<string, string[]> = {
  NVDA: ['NVDA_Stock', 'wallstreetbets', 'stocks'],
  NVDY: ['dividends', 'stocks'],
  SCHD: ['dividends', 'ETFs', 'stocks'],
  SPY: ['stocks', 'investing', 'wallstreetbets'],
  SPYM: ['ETFs', 'investing'],
  QYLD: ['dividends', 'ETFs'],
  AMD: ['AMD_Stock', 'stocks', 'wallstreetbets'],
  ARKX: ['ETFs', 'stocks'],
  UFO: ['ETFs', 'stocks'],
};

const DEFAULT_SUBREDDITS = ['stocks'];

interface RedditChild {
  data: {
    subreddit?: string;
    title?: string;
    score?: number;
    selftext?: string;
    permalink?: string;
    created_utc?: number;
  };
}

interface RedditListing {
  data?: {
    children?: RedditChild[];
  };
}

function userAgent(): string {
  const ua = process.env.REDDIT_USER_AGENT?.trim();
  return ua && ua.length > 0 ? ua : 'stock-daily-video/1.0';
}

async function searchOne(
  ticker: string,
  subreddit: string,
): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json?q=${encodeURIComponent(ticker)}&restrict_sr=1&sort=top&t=day&limit=10`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent() } });
    if (!res.ok) {
      console.warn(`[reddit] r/${subreddit} q=${ticker} HTTP ${res.status}`);
      return [];
    }
    const json = (await res.json()) as RedditListing;
    const children = json.data?.children ?? [];
    const posts: RedditPost[] = [];
    for (const c of children) {
      const d = c.data;
      if (!d.title || !d.permalink || typeof d.score !== 'number' || typeof d.created_utc !== 'number') continue;
      const excerpt = (d.selftext ?? '').slice(0, 280);
      posts.push({
        ticker,
        subreddit: d.subreddit ?? subreddit,
        title: d.title,
        score: d.score,
        excerpt,
        url: `https://www.reddit.com${d.permalink}`,
        createdAt: new Date(d.created_utc * 1000).toISOString(),
      });
    }
    return posts;
  } catch (err) {
    console.warn(`[reddit] r/${subreddit} q=${ticker} 실패`, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchRedditBatch(
  holdings: HoldingWithData[],
): Promise<Record<string, RedditPost[]>> {
  const out: Record<string, RedditPost[]> = {};

  for (const h of holdings) {
    const subs = TICKER_TO_SUBREDDITS[h.ticker] ?? DEFAULT_SUBREDDITS;

    // subreddit 별 search 병렬
    const settled = await Promise.allSettled(subs.map(s => searchOne(h.ticker, s)));
    const merged: RedditPost[] = settled.flatMap(r => (r.status === 'fulfilled' ? r.value : []));

    // score 내림차순, 상위 3개
    merged.sort((a, b) => b.score - a.score);
    out[h.yahooSymbol] = merged.slice(0, 5);
  }

  return out;
}
