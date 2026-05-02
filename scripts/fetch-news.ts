import type { Holding, NewsItem } from '../src/types';
import { fetchYahooNews } from './news/yahoo';
import { fetchGoogleNews } from './news/google-rss';

function dedupeByLink(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    if (seen.has(it.link)) continue;
    seen.add(it.link);
    out.push(it);
  }
  return out;
}

export async function fetchNews(holding: Holding): Promise<NewsItem[]> {
  const symbol = holding.yahooSymbol;
  const isKR = holding.market === 'KR';

  // UFO·MOON 등 일반어 티커는 그냥 검색하면 주식이 아닌 결과가 섞여 들어옴.
  // 한국어는 "주가", 영어는 "stock" 컨텍스트를 항상 붙여 disambiguate.
  const koQuery = `${holding.name} 주가`;
  const enQuery = `${holding.ticker} stock`;

  // 한국 종목: 한국어 검색만 / 미국 종목: 한국어 + 영어 둘 다
  const queries: Array<{ q: string; locale: 'ko' | 'en' }> = isKR
    ? [{ q: koQuery, locale: 'ko' }]
    : [
        { q: koQuery, locale: 'ko' },
        { q: enQuery, locale: 'en' },
      ];

  const tasks: Array<Promise<NewsItem[]>> = [
    fetchYahooNews(symbol, 5),
    ...queries.map(({ q, locale }) => fetchGoogleNews(symbol, q, locale, 6)),
  ];

  const settled = await Promise.allSettled(tasks);
  const merged: NewsItem[] = settled.flatMap(r =>
    r.status === 'fulfilled' ? r.value : [],
  );

  // 시간 내림차순 정렬 후 dedupe
  merged.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return dedupeByLink(merged).slice(0, 12);
}

export async function fetchNewsBatch(
  holdings: Holding[],
): Promise<Record<string, NewsItem[]>> {
  const settled = await Promise.allSettled(holdings.map(h => fetchNews(h)));
  const out: Record<string, NewsItem[]> = {};
  holdings.forEach((h, i) => {
    const r = settled[i];
    out[h.yahooSymbol] = r && r.status === 'fulfilled' ? r.value : [];
  });
  return out;
}
