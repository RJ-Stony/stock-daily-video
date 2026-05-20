import { z } from 'zod';

export const HoldingSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  name: z.string(),
  market: z.enum(['US', 'KR']),
  yahooSymbol: z.string(),
  tags: z.array(z.string()),
  active: z.boolean(),
});

export const PriceDataSchema = z.object({
  ticker: z.string(),
  current: z.number(),
  previousClose: z.number(),
  changePct: z.number(),
  spark: z.array(z.number()),
});

export const NewsItemSchema = z.object({
  ticker: z.string(),
  title: z.string(),
  publisher: z.string(),
  link: z.string(),
  publishedAt: z.string(),
  description: z.string().optional(), // 본문 요약 (Google News RSS에서 추출, Yahoo는 비어있음)
});

export const HoldingWithDataSchema = HoldingSchema.extend({
  price: PriceDataSchema,
  news: z.array(NewsItemSchema),
});

// ─── 마일스톤 2: 분석 콘텐츠 ───────────────────────────────────────

export const InsightSchema = z.object({
  ticker: z.string(),
  headline: z.string(),
  body: z.string(),
  generatedAt: z.string(), // ISO 8601
});

export const YouTubeVideoSchema = z.object({
  ticker: z.string(),
  videoId: z.string(),
  title: z.string(),
  channel: z.string(),
  thumbnailUrl: z.string(), // URL
  publishedAt: z.string(), // ISO 8601
  viewCount: z.number().int().nonnegative().optional(),
  durationSec: z.number().int().positive(),
});

// 시장 반응 — YouTube 영상 댓글 + StockTwits 포스트 등 다중 소스 지원
export const CommentSchema = z.object({
  ticker: z.string(),
  source: z.enum(['youtube', 'stocktwits']),
  channel: z.string(),                       // YouTube 채널명 또는 "StockTwits"
  videoTitle: z.string().optional(),         // YouTube 전용
  videoId: z.string().optional(),            // YouTube 전용
  author: z.string(),                        // 댓글/포스트 작성자
  text: z.string().max(500),                 // 본문 (길면 잘림)
  likeCount: z.number().int().nonnegative(), // YouTube likeCount 또는 StockTwits likes
  publishedAt: z.string(),                   // ISO 8601
});

export const EnrichedHoldingSchema = HoldingWithDataSchema.extend({
  insight: InsightSchema,
  videos: z.array(YouTubeVideoSchema),
  reactions: z.array(CommentSchema),
});

export const DailyDataSchema = z.object({
  date: z.string(),
  holdings: z.array(EnrichedHoldingSchema),
});

export type Holding = z.infer<typeof HoldingSchema>;
export type PriceData = z.infer<typeof PriceDataSchema>;
export type NewsItem = z.infer<typeof NewsItemSchema>;
export type HoldingWithData = z.infer<typeof HoldingWithDataSchema>;
export type DailyData = z.infer<typeof DailyDataSchema>;
export type Insight = z.infer<typeof InsightSchema>;
export type YouTubeVideo = z.infer<typeof YouTubeVideoSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type EnrichedHolding = z.infer<typeof EnrichedHoldingSchema>;
