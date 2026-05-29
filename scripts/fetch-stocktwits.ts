import 'dotenv/config';
import type { Comment, HoldingWithData } from '../src/types';

// StockTwits 는 미국 종목 중심 투자자 커뮤니티이므로 미국 종목에 한해 호출.
// public stream endpoint(/streams/symbol/<SYMBOL>.json) 사용 — 인증 불필요, IP 기반 rate limit 존재.
// Reddit 의 무인증 .json 이 403 으로 막힌(이슈 #4) 뒤 대체 소스로 채택.
const USER_AGENT =
  'stock-daily-video/0.1 (+https://github.com/RJ-Stony/stock-daily-video) Node.js fetch';

const PER_HOLDING = 5;
// 공개 스트림은 좋아요가 거의 항상 0(아직 누적 전)이라 좋아요로는 거를 수 없다.
// 대신 작성자 팔로워 수를 신뢰도 신호로 쓰고, 최소 팔로워로 일회용 펌핑 계정을 1차 컷한다.
const MIN_FOLLOWERS = 50;
const MAX_TEXT = 320;
const MIN_TEXT = 15;

interface StockTwitsUser {
  username?: string;
  followers?: number;
}

interface StockTwitsMessage {
  id?: number;
  body?: string;
  created_at?: string;
  user?: StockTwitsUser;
}

interface StockTwitsResponse {
  messages?: StockTwitsMessage[];
}

// 앞쪽에 줄줄이 붙는 cashtag($NVDA $SPY …)·멘션(@user)·URL 을 정리해 본문만 남긴다.
function clean(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[$@][A-Za-z][A-Za-z0-9.\-]*/g, ' ') // cashtag·멘션 제거
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT);
}

async function fetchStockTwitsForTicker(ticker: string): Promise<Comment[]> {
  const url = `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(ticker)}.json`;

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) {
    console.warn(`[stocktwits] ${ticker} HTTP ${res.status}`);
    return [];
  }

  const json = (await res.json()) as StockTwitsResponse;
  const items: Comment[] = [];

  for (const m of json.messages ?? []) {
    if (!m.body || !m.user?.username || !m.created_at || typeof m.id !== 'number') continue;

    const followers = m.user.followers ?? 0;
    if (followers < MIN_FOLLOWERS) continue;

    const text = clean(m.body);
    // cashtag·링크만 있던 글은 정리 후 본문이 거의 안 남으므로 컷.
    if (text.length < MIN_TEXT) continue;

    const username = m.user.username;
    items.push({
      ticker,
      source: 'stocktwits',
      channel: `@${username}`,
      permalink: `https://stocktwits.com/${username}/message/${m.id}`,
      author: username,
      text,
      // 좋아요는 공개 스트림에서 사실상 0이라, 작성자 팔로워 수를 신뢰도 지표로 노출.
      likeCount: followers,
      publishedAt: new Date(m.created_at).toISOString(),
    });
  }

  // 팔로워 많은(신뢰도 높은) 순 → 동률이면 최신순.
  items.sort((a, b) => b.likeCount - a.likeCount || (a.publishedAt < b.publishedAt ? 1 : -1));
  return items.slice(0, PER_HOLDING);
}

export async function fetchStockTwitsBatch(
  holdings: HoldingWithData[],
): Promise<Record<string, Comment[]>> {
  const out: Record<string, Comment[]> = {};

  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i];
    if (h.market === 'KR') {
      // StockTwits 는 미국 심볼 위주라 한국 ETF 토론이 거의 없어 호출 자체를 스킵.
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
