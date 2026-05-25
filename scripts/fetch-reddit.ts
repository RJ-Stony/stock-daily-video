import 'dotenv/config';
import type { Comment, HoldingWithData } from '../src/types';

// Reddit 은 영문 커뮤니티이므로 미국 종목에 한해 호출.
// 2024년부터 unauthenticated 호출은 거의 차단(HTTP 403)되어, OAuth(script-app password grant)가
// 사실상 유일한 안정 경로. 환경변수 4종(REDDIT_CLIENT_ID/SECRET/USERNAME/PASSWORD)이 모두
// 채워져 있으면 oauth.reddit.com 으로 호출하고, 없으면 공개 엔드포인트를 한 번만 시도해보고
// 403이 떨어지는 순간 이후 종목은 스킵(소음 줄이고 시간 절약).
const USER_AGENT =
  'stock-daily-video/0.2 (+https://github.com/RJ-Stony/stock-daily-video) by /u/anonymous';

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

interface RedditAuth {
  token: string;
  expiresAt: number; // epoch ms
}

let cachedAuth: RedditAuth | null = null;

async function getRedditAccessToken(): Promise<RedditAuth | null> {
  if (cachedAuth && cachedAuth.expiresAt > Date.now() + 60_000) return cachedAuth;

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;
  if (!clientId || !clientSecret || !username || !password) return null;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({ grant_type: 'password', username, password });
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`[reddit] OAuth 토큰 발급 실패 HTTP ${res.status} — ${text.slice(0, 200)}`);
    return null;
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    console.warn('[reddit] OAuth 응답에 access_token 없음 — 공개 엔드포인트로 폴백');
    return null;
  }
  cachedAuth = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedAuth;
}

interface FetchResult {
  items: Comment[];
  // 비인증 모드에서 403이 떨어졌는지 — 떨어지면 이후 종목은 스킵
  blocked?: boolean;
}

async function fetchRedditForTicker(
  ticker: string,
  name: string,
  auth: RedditAuth | null,
): Promise<FetchResult> {
  // 본문 검색 시 ticker 토큰을 그대로 쓰면 일반 단어와 충돌하므로 큰따옴표로 묶고
  // ETF 명도 보조 키워드로 OR 결합. r/<multi>/search.json + restrict_sr=on 으로 서브레딧만 검색.
  const queryTokens = [`"${ticker}"`];
  if (name && name !== ticker) queryTokens.push(`"${name}"`);
  const q = queryTokens.join(' OR ');

  const host = auth ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  const url = new URL(`${host}/r/${SUBREDDIT_PATH}/search.json`);
  url.searchParams.set('q', q);
  url.searchParams.set('sort', 'top');
  url.searchParams.set('t', 'week');
  url.searchParams.set('limit', '15');
  url.searchParams.set('restrict_sr', 'on');

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  };
  if (auth) headers.Authorization = `Bearer ${auth.token}`;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    return { items: [], blocked: res.status === 403 && !auth };
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
  return { items: items.slice(0, PER_HOLDING) };
}

export async function fetchRedditBatch(
  holdings: HoldingWithData[],
): Promise<Record<string, Comment[]>> {
  const out: Record<string, Comment[]> = {};
  const auth = await getRedditAccessToken();
  if (auth) {
    console.log('[reddit] OAuth 인증 사용 (oauth.reddit.com)');
  } else {
    console.log('[reddit] OAuth 미설정 — 공개 엔드포인트 시도 (403 시 이후 종목 스킵)');
  }

  let publicBlocked = false;

  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i];
    if (h.market === 'KR') {
      // Reddit 영문 커뮤니티는 한국 ETF 토론이 거의 없어 호출 자체를 스킵.
      out[h.yahooSymbol] = [];
      continue;
    }
    if (publicBlocked) {
      out[h.yahooSymbol] = [];
      continue;
    }

    process.stdout.write(`[reddit] (${i + 1}/${holdings.length}) ${h.ticker} 검색 중... `);
    const t0 = Date.now();
    try {
      const result = await fetchRedditForTicker(h.ticker, h.name, auth);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      out[h.yahooSymbol] = result.items;
      if (result.blocked) {
        publicBlocked = true;
        console.log(`HTTP 403 — 이후 종목 스킵 (${elapsed}s)`);
      } else {
        console.log(`${result.items.length}건 (${elapsed}s)`);
      }
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`실패 (${elapsed}s) — ${err instanceof Error ? err.message : err}`);
      out[h.yahooSymbol] = [];
    }
  }

  return out;
}
