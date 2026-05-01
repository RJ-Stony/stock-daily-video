import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import { NewsItemSchema, type NewsItem } from '../../src/types';

const USER_AGENT = 'Mozilla/5.0 (compatible; StockDailyBot/1.0)';

type Locale = 'ko' | 'en';

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  source?: string | { '#text'?: string };
  description?: string;
}

interface RssChannel {
  rss?: { channel?: { item?: RssItem | RssItem[] } };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

function buildUrl(query: string, locale: Locale): string {
  const params = locale === 'ko'
    ? { hl: 'ko', gl: 'KR', ceid: 'KR:ko' }
    : { hl: 'en-US', gl: 'US', ceid: 'US:en' };
  const q = `?q=${encodeURIComponent(query)}&hl=${params.hl}&gl=${params.gl}&ceid=${params.ceid}`;
  return `https://news.google.com/rss/search${q}`;
}

function extractSource(source: RssItem['source']): string {
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && '#text' in source) return source['#text'] ?? '';
  return '';
}

export async function fetchGoogleNews(
  ticker: string,
  query: string,
  locale: Locale,
  count = 8,
): Promise<NewsItem[]> {
  const url = buildUrl(query, locale);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
      console.warn(`[news/google] ${query}@${locale} HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const parsed = parser.parse(xml) as RssChannel;
    const itemsRaw = parsed.rss?.channel?.item;
    const items: RssItem[] = Array.isArray(itemsRaw) ? itemsRaw : itemsRaw ? [itemsRaw] : [];

    const news: NewsItem[] = items.slice(0, count).flatMap(item => {
      if (!item.title || !item.link || !item.pubDate) return [];
      const publisher = extractSource(item.source) || 'Google News';
      const publishedAt = new Date(item.pubDate).toISOString();
      // description은 보통 HTML 형태로 옴 — 태그 제거 + 240자 제한
      const rawDesc = typeof item.description === 'string' ? item.description : '';
      const cleanDesc = rawDesc
        .replace(/<[^>]+>/g, ' ')      // HTML 태그 제거
        .replace(/&[a-z]+;/gi, ' ')   // HTML 엔티티 거칠게 제거
        .replace(/\s+/g, ' ')          // 연속 공백 정리
        .trim()
        .slice(0, 240);
      return [{
        ticker,
        title: item.title,
        publisher,
        link: item.link,
        publishedAt,
        ...(cleanDesc ? { description: cleanDesc } : {}),
      }];
    });

    const safe = z.array(NewsItemSchema).safeParse(news);
    return safe.success ? safe.data : [];
  } catch (err) {
    console.warn(`[news/google] ${query}@${locale} 실패`, err instanceof Error ? err.message : err);
    return [];
  }
}
