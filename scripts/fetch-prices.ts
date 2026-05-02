import { type PriceData } from '../src/types';

const USER_AGENT = 'Mozilla/5.0 (compatible; StockDailyBot/1.0)';

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice?: number;
        // 차트(range) 시작 직전 종가 — range=1mo면 한 달 전 종가. 일일 변동률 계산엔 부적합.
        chartPreviousClose?: number;
        // 직전 거래일 종가 — 일일 변동률 계산에 정확한 값.
        previousClose?: number;
        regularMarketPreviousClose?: number;
      };
      indicators: {
        quote: Array<{ close: Array<number | null> }>;
      };
    }> | null;
    error: unknown;
  };
}

export async function fetchPrice(symbol: string): Promise<PriceData | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
      console.warn(`[fetch-prices] ${symbol} HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as YahooChartResponse;
    const result = json.chart?.result?.[0];
    if (!result) {
      console.warn(`[fetch-prices] ${symbol} 빈 결과`);
      return null;
    }
    const current = result.meta.regularMarketPrice;
    const closes = (result.indicators.quote[0]?.close ?? []).filter((v): v is number => typeof v === 'number');

    // 직전 거래일 종가 — 일일 변동률용. 우선순위:
    // 1) meta.previousClose (가장 정확) 2) meta.regularMarketPreviousClose
    // 3) closes 배열의 끝에서 두 번째 (오늘 마감가가 마지막일 때)
    // 4) 그래도 없으면 chartPreviousClose (한 달 누적이지만 fallback)
    const previousClose =
      result.meta.previousClose ??
      result.meta.regularMarketPreviousClose ??
      (closes.length >= 2 ? closes[closes.length - 2] : undefined) ??
      result.meta.chartPreviousClose;

    if (typeof current !== 'number' || typeof previousClose !== 'number' || closes.length === 0) {
      console.warn(`[fetch-prices] ${symbol} 필드 누락`);
      return null;
    }
    const changePct = ((current - previousClose) / previousClose) * 100;
    const spark = closes.slice(-30);
    return { ticker: symbol, current, previousClose, changePct, spark };
  } catch (err) {
    console.warn(`[fetch-prices] ${symbol} 실패`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function fetchPrices(symbols: string[]): Promise<Record<string, PriceData | null>> {
  const settled = await Promise.allSettled(symbols.map(s => fetchPrice(s)));
  const out: Record<string, PriceData | null> = {};
  symbols.forEach((s, i) => {
    const r = settled[i];
    out[s] = r && r.status === 'fulfilled' ? r.value : null;
  });
  return out;
}
