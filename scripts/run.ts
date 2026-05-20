import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fetchActiveHoldings } from './fetch-notion';
import { fetchPrices } from './fetch-prices';
import { fetchNewsBatch } from './fetch-news';
import { fetchInsightBatch, translateReactionsBatch, translateNewsBatch } from './fetch-gemma-insight';
import { fetchYouTubeBatch } from './fetch-youtube';
import { fetchCommentsBatch } from './fetch-comments';
import { fetchStockTwitsBatch } from './fetch-stocktwits';
import { renderDaily } from './render';
import { uploadFile } from './upload';
import { renderThumbnail } from './render-thumbnail';
import { sendKakaoMessage } from './notify-kakao';
import { z } from 'zod';
import { DailyDataSchema, EnrichedHoldingSchema, type Comment, type EnrichedHolding, type Insight } from '../src/types';

// 서로 다른 출처(YouTube · StockTwits)의 반응을 인터리브해 시장 반응 슬라이드의 다양성을 확보.
function interleave<T>(...arrs: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...arrs.map(a => a.length));
  for (let i = 0; i < max; i++) {
    for (const arr of arrs) {
      if (arr[i] !== undefined) out.push(arr[i]);
    }
  }
  return out;
}

function emptyInsight(ticker: string): Insight {
  return { ticker, headline: '', body: '', generatedAt: new Date().toISOString() };
}

async function main(): Promise<void> {
  console.time('[run] total');

  // KST(Asia/Seoul) 기준 YYYY-MM-DD. 'en-CA' locale은 ISO 형식 반환.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const cachePath = join('out', 'cache', `${today}.json`);
  mkdirSync(dirname(cachePath), { recursive: true });

  let enrichedHoldings: EnrichedHolding[] | null = null;

  if (existsSync(cachePath)) {
    try {
      const raw = JSON.parse(readFileSync(cachePath, 'utf8')) as unknown;
      const parsed = z.array(EnrichedHoldingSchema).safeParse(raw);
      if (parsed.success) {
        console.log('[run] cache hit', cachePath);
        enrichedHoldings = parsed.data;
      } else {
        console.warn('[run] cache schema mismatch — 재생성', cachePath);
      }
    } catch (err) {
      console.warn('[run] cache parse 실패 — 재생성', err instanceof Error ? err.message : err);
    }
  }

  if (enrichedHoldings === null) {
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
    const [prices, rawNewsByYahooSymbol] = await Promise.all([
      fetchPrices(symbols),
      fetchNewsBatch(holdings),
    ]);
    console.timeEnd('[run] prices+news');

    // 종목 단위 라벨 ("엔비디아 (NVDA)") — 번역 프롬프트 컨텍스트용
    const holdingLabelByYahooSymbol: Record<string, string> = {};
    for (const h of holdings) holdingLabelByYahooSymbol[h.yahooSymbol] = `${h.name} (${h.ticker})`;

    console.time('[run] translate-news');
    const newsByYahooSymbol = await translateNewsBatch(rawNewsByYahooSymbol, holdingLabelByYahooSymbol);
    console.timeEnd('[run] translate-news');

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

    console.time('[run] enrich-insights+videos');
    const [insights, videos] = await Promise.all([
      fetchInsightBatch(holdingsWithData),
      fetchYouTubeBatch(holdingsWithData),
    ]);
    console.timeEnd('[run] enrich-insights+videos');

    console.time('[run] enrich-comments');
    const [youtubeReactions, stockTwitsReactions] = await Promise.all([
      fetchCommentsBatch(holdingsWithData, videos),
      fetchStockTwitsBatch(holdingsWithData),
    ]);
    // 종목별로 두 소스를 인터리브 — 위쪽엔 YouTube/StockTwits가 번갈아 등장하도록 섞는다.
    // 번역 단계에서 LLM이 관련성 없다고 판단하면 빠지므로, 너무 많이 합치지 말고 각 6개 한도.
    const reactions: Record<string, Comment[]> = {};
    for (const h of holdingsWithData) {
      const yt = (youtubeReactions[h.yahooSymbol] ?? []).slice(0, 6);
      const st = (stockTwitsReactions[h.yahooSymbol] ?? []).slice(0, 6);
      reactions[h.yahooSymbol] = interleave(yt, st);
    }
    console.timeEnd('[run] enrich-comments');

    console.time('[run] translate-reactions');
    const translatedReactions = await translateReactionsBatch(reactions, holdingLabelByYahooSymbol);
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

  if (!enrichedHoldings) throw new Error('unreachable');

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
