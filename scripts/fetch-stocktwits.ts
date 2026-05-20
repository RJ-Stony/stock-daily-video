import 'dotenv/config';
import type { Comment, HoldingWithData } from '../src/types';

// StockTwits 공개 API — 인증 불필요, IP 기반 200 req/hour 제한.
// 미국 종목 한정 (KR 종목은 StockTwits에서 거의 다뤄지지 않음).

const PER_HOLDING = 5;
const MIN_LIKES = 1;
const MIN_TEXT_LEN = 20;
const MAX_TEXT = 320;

interface StockTwitsMessage {
  id: number;
  body: string;
  created_at: string;
  user: {
    username: string;
    followers?: number;
  };
  likes?: { total: number };
  entities?: {
    sentiment?: { basic?: 'Bullish' | 'Bearish' };
  };
}

interface StockTwitsResponse {
  response: { status: number };
  messages?: StockTwitsMessage[];
}

function clean(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')  // URL 제거
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT);
}

async function fetchStockTwitsForTicker(ticker: string): Promise<Comment[]> {
  const url = `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(ticker)}.json`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'stock-daily-video/0.1' },
  });
  if (!res.ok) {
    console.warn(`[stocktwits] ${ticker} HTTP ${res.status}`);
    return [];
  }

  const json = (await res.json()) as StockTwitsResponse;
  const items: Comment[] = [];

  for (const msg of json.messages ?? []) {
    if (!msg.body || !msg.user?.username) continue;

    const likes = msg.likes?.total ?? 0;
    if (likes < MIN_LIKES) continue;

    const bodyClean = clean(msg.body);
    if (bodyClean.length < MIN_TEXT_LEN) continue;

    // 감성 태그([Bullish]/[Bearish])를 앞에 붙여 Gemini 번역 시 자연스럽게 강세/약세로 변환되도록 유도
    const sentiment = msg.entities?.sentiment?.basic;
    const text = sentiment ? `[${sentiment}] ${bodyClean}` : bodyClean;

    items.push({
      ticker,
      source: 'stocktwits',
      channel: 'StockTwits',
      author: msg.user.username,
      text,
      likeCount: likes,
      publishedAt: msg.created_at,
    });
  }

  items.sort((a, b) => b.likeCount - a.likeCount);
  return items.slice(0, PER_HOLDING);
}

export async function fetchStockTwitsBatch(
  holdings: HoldingWithData[],
): Promise<Record<string, Comment[]>> {
  const out: Record<string, Comment[]> = {};

  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i];
    if (h.market === 'KR') {
      out[h.yahooSymbol] = [];
      continue;
    }

    process.stdout.write(`[stocktwits] (${i + 1}/${holdings.length}) ${h.ticker} 검색 중... `);
    const t0 = Date.now();
    try {
      const items = await fetchStockTwitsForTicker(h.ticker);
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
