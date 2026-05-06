import 'dotenv/config';
import type { Comment, HoldingWithData } from '../src/types';

// Reddit 은 영문 커뮤니티이므로 미국 종목에 한해 호출.
// public JSON endpoint(/search.json) 사용 — 인증 불필요, 단 IP 기반 rate limit 존재.
// Reddit 측 정책상 고유 User-Agent 필수.
const USER_AGENT =
  'stock-daily-video/0.1 (+https://github.com/RJ-Stony/stock-daily-video) Node.js fetch';

const SUBREDDITS = ['stocks', 'investing', 'wallstreetbets', 'StockMarket', 'ETFs'];
const SUBREDDIT_PATH = SUBREDDITS.join('+');

const PER_HOLDING = 5;
const MIN_SCORE = 5;
const MAX_TEXT = 320;

interface RedditPostData {
  title?: string;
  selftext?: string;
  author?: string;
  score?: number;
  permalink?: string;
  created_utc?: number;
  subreddit?: string;
  over_18?: boolean;
  stickied?: boolean;
  removed_by_category?: string | null;
}

interface RedditChild {
  data?: RedditPostData;
}

interface RedditSearchResponse {
  data?: {
    children?: RedditChild[];
  };
}

function clean(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x200B;/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT);
}

async function fetchRedditForTicker(
  ticker: string,
  name: string,
): Promise<Comment[]> {
  // 본문 검색 시 ticker 토큰을 그대로 쓰면 일반 단어와 충돌하므로 큰따옴표로 묶고
  // ETF 명도 보조 키워드로 OR 결합. r/<multi>/search.json + restrict_sr=on 으로 서브레딧만 검색.
  const queryTokens = [`"${ticker}"`];
  if (name && name !== ticker) queryTokens.push(`"${name}"`);
  const q = queryTokens.join(' OR ');

  const url = new URL(`https://www.reddit.com/r/${SUBREDDIT_PATH}/search.json`);
  url.searchParams.set('q', q);
  url.searchParams.set('sort', 'top');
  url.searchParams.set('t', 'week');
  url.searchParams.set('limit', '15');
  url.searchParams.set('restrict_sr', 'on');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) {
    console.warn(`[reddit] ${ticker} HTTP ${res.status}`);
    return [];
  }
  const json = (await res.json()) as RedditSearchResponse;
  const items: Comment[] = [];
  const tickerLow = ticker.toLowerCase();

  for (const ch of json.data?.children ?? []) {
    const d = ch.data;
    if (!d) continue;
    if (!d.title || !d.author || !d.permalink || typeof d.created_utc !== 'number') continue;
    if (typeof d.score !== 'number' || d.score < MIN_SCORE) continue;
    if (d.stickied || d.over_18 || d.removed_by_category) continue;

    // 제목 + selftext 일부를 본문으로 합쳐 노출. 단, 어디에도 ticker가 안 보이면 노이즈로 간주.
    const titleClean = clean(d.title);
    const bodyClean = d.selftext ? clean(d.selftext) : '';
    const combined = (titleClean + ' ' + bodyClean).toLowerCase();
    if (!combined.includes(tickerLow)) continue;

    let text = titleClean;
    if (bodyClean) {
      const remain = MAX_TEXT - titleClean.length - 3;
      if (remain > 30) text = `${titleClean} — ${bodyClean.slice(0, remain)}`;
    }
    if (text.length < 15) continue;

    items.push({
      ticker,
      source: 'reddit',
      channel: `r/${d.subreddit ?? 'stocks'}`,
      permalink: d.permalink,
      author: d.author,
      text,
      likeCount: d.score,
      publishedAt: new Date(d.created_utc * 1000).toISOString(),
    });
  }

  items.sort((a, b) => b.likeCount - a.likeCount);
  return items.slice(0, PER_HOLDING);
}

export async function fetchRedditBatch(
  holdings: HoldingWithData[],
): Promise<Record<string, Comment[]>> {
  const out: Record<string, Comment[]> = {};

  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i];
    if (h.market === 'KR') {
      // Reddit 영문 커뮤니티는 한국 ETF 토론이 거의 없어 호출 자체를 스킵.
      out[h.yahooSymbol] = [];
      continue;
    }

    process.stdout.write(`[reddit] (${i + 1}/${holdings.length}) ${h.ticker} 검색 중... `);
    const t0 = Date.now();
    try {
      const items = await fetchRedditForTicker(h.ticker, h.name);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      out[h.yahooSymbol] = items;
      console.log(`${items.length}건 (${elapsed}s)`);
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`실패 (${elapsed}s) — ${err instanceof Error ? err.message : err}`);
      out[h.yahooSymbol] = [];
    }
  }

  return out;
}
