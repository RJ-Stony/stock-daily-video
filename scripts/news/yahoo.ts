import { z } from 'zod';
import { NewsItemSchema, type NewsItem } from '../../src/types';

const USER_AGENT = 'Mozilla/5.0 (compatible; StockDailyBot/1.0)';

interface YahooSearchResponse {
  news?: Array<{
    title?: string;
    publisher?: string;
    link?: string;
    providerPublishTime?: number;
  }>;
}

export async function fetchYahooNews(query: string, count = 5): Promise<NewsItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=${count}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
      console.warn(`[news/yahoo] ${query} HTTP ${res.status}`);
      return [];
    }
    const json = (await res.json()) as YahooSearchResponse;
    const raw = (json.news ?? [])
      .filter(n => n.title && n.publisher && n.link && typeof n.providerPublishTime === 'number')
      .map(n => ({
        ticker: query,
        title: n.title!,
        publisher: n.publisher!,
        link: n.link!,
        publishedAt: new Date(n.providerPublishTime! * 1000).toISOString(),
      }));
    const parsed = z.array(NewsItemSchema).safeParse(raw);
    return parsed.success ? parsed.data : [];
  } catch (err) {
    console.warn(`[news/yahoo] ${query} 실패`, err instanceof Error ? err.message : err);
    return [];
  }
}
