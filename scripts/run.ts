import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fetchActiveHoldings } from './fetch-notion';
import { fetchPrices } from './fetch-prices';
import { fetchNewsBatch } from './fetch-news';
import { fetchInsightBatch, translateReactionsBatch } from './fetch-gemma-insight';
import { fetchYouTubeBatch } from './fetch-youtube';
import { fetchRedditBatch } from './fetch-reddit';
import { renderDaily } from './render';
import { uploadFile } from './upload';
import { renderThumbnail } from './render-thumbnail';
import { sendKakaoMessage } from './notify-kakao';
import { DailyDataSchema, type EnrichedHolding, type Insight } from '../src/types';

function emptyInsight(ticker: string): Insight {
  return { ticker, headline: '', body: '', generatedAt: new Date().toISOString() };
}

async function main(): Promise<void> {
  console.time('[run] total');

  // KST(Asia/Seoul) 기준 YYYY-MM-DD. 'en-CA' locale은 ISO 형식 반환.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const cachePath = join('out', 'cache', `${today}.json`);
  mkdirSync(dirname(cachePath), { recursive: true });

  let enrichedHoldings: EnrichedHolding[];

  if (existsSync(cachePath)) {
    console.log('[run] cache hit', cachePath);
    enrichedHoldings = JSON.parse(readFileSync(cachePath, 'utf8')) as EnrichedHolding[];
  } else {
    console.log('[run] cache miss — 모든 fetch 실행');

    console.time('[run] notion');
    const holdings = await fetchActiveHoldings();
    console.timeEnd('[run] notion');
    console.log(`[run] notion: ${holdings.length}개 종목`);

    if (holdings.length === 0) {
      console.error('[run] Notion에서 Active 종목이 0개입니다. 종료.');
      process.exit(1);
    }

    const symbols = holdings.map(h => h.yahooSymbol);

    console.time('[run] prices+news');
    const [prices, newsByYahooSymbol] = await Promise.all([
      fetchPrices(symbols),
      fetchNewsBatch(holdings),
    ]);
    console.timeEnd('[run] prices+news');

    // 1차 merge — HoldingWithData 만들기 (insight/videos/reactions는 다음 단계)
    const holdingsWithData = holdings.map(h => ({
      ...h,
      price: prices[h.yahooSymbol] ?? {
        ticker: h.yahooSymbol,
        current: 0,
        previousClose: 0,
        changePct: 0,
        spark: [],
      },
      news: newsByYahooSymbol[h.yahooSymbol] ?? [],
    }));

    // 2차 enrichment — 3개 동시
    console.time('[run] enrich');
    const [insights, videos, reactions] = await Promise.all([
      fetchInsightBatch(holdingsWithData),
      fetchYouTubeBatch(holdingsWithData),
      fetchRedditBatch(holdingsWithData),
    ]);
    console.timeEnd('[run] enrich');

    console.time('[run] translate-reactions');
    const translatedReactions = await translateReactionsBatch(reactions);
    console.timeEnd('[run] translate-reactions');

    enrichedHoldings = holdingsWithData.map(h => ({
      ...h,
      insight: insights[h.yahooSymbol] ?? emptyInsight(h.ticker),
      videos: videos[h.yahooSymbol] ?? [],
      reactions: translatedReactions[h.yahooSymbol] ?? [],
    }));

    // 캐시 저장
    writeFileSync(cachePath, JSON.stringify(enrichedHoldings, null, 2), 'utf8');
    console.log('[run] cache saved', cachePath);
  }

  const data = DailyDataSchema.parse({ date: today, holdings: enrichedHoldings });

  console.time('[run] render');
  const outPath = await renderDaily(data);
  console.timeEnd('[run] render');
  console.log(`[run] rendered: ${outPath}`);

  console.time('[run] thumbnail');
  const thumbPath = await renderThumbnail(data);
  console.timeEnd('[run] thumbnail');
  console.log(`[run] thumbnail: ${thumbPath}`);

  console.time('[run] upload');
  const [videoUrl, thumbnailUrl] = await Promise.all([
    uploadFile(outPath, `${today}.mp4`, 'video/mp4'),
    uploadFile(thumbPath, `${today}.jpg`, 'image/jpeg'),
  ]);
  console.timeEnd('[run] upload');

  const avgPct = enrichedHoldings.length > 0
    ? (enrichedHoldings.reduce((s, h) => s + h.price.changePct, 0) / enrichedHoldings.length).toFixed(2)
    : '0.00';
  const upCount = enrichedHoldings.filter(h => h.price.changePct > 0).length;
  const downCount = enrichedHoldings.filter(h => h.price.changePct < 0).length;
  const summary = `${enrichedHoldings.length}종목 평균 ${avgPct}% (↑${upCount} ↓${downCount})`;

  await sendKakaoMessage(videoUrl, thumbnailUrl, summary, today);

  console.timeEnd('[run] total');
  console.log('[run] done', { videoUrl, thumbnailUrl, summary });
}

main().catch(err => {
  console.error('[run] 실패:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
