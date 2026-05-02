import 'dotenv/config';

// 격리 테스트: YouTube Data API 호출이 왜 거의 모두 403을 받는지 reason 확인.
// pnpm exec tsx scripts/test-youtube.ts

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error('YOUTUBE_API_KEY missing');
  process.exit(1);
}

const queries = [
  '엔비디아 (NVDA) 주가 분석',
  'NVDA stock analysis',
  'AMD stock analysis',
  'SPY stock analysis',
  'QYLD 주가 분석',
];

interface ErrorBody {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ domain?: string; reason?: string; message?: string }>;
    status?: string;
  };
}

async function rawSearch(query: string, publishedAfterDays: number): Promise<{ status: number; bodySnippet: string; itemCount: number; reason?: string }> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', '10');
  url.searchParams.set('videoDuration', 'medium');
  url.searchParams.set('order', 'relevance');
  url.searchParams.set('publishedAfter', new Date(Date.now() - publishedAfterDays * 86400000).toISOString());
  url.searchParams.set('key', API_KEY!);

  const res = await fetch(url.toString());
  const text = await res.text();
  let itemCount = 0;
  let reason: string | undefined;
  if (res.ok) {
    try {
      const json = JSON.parse(text) as { items?: unknown[] };
      itemCount = json.items?.length ?? 0;
    } catch { /* ignore */ }
  } else {
    try {
      const json = JSON.parse(text) as ErrorBody;
      reason = json.error?.errors?.[0]?.reason ?? json.error?.status;
    } catch { /* ignore */ }
  }
  return { status: res.status, bodySnippet: text.slice(0, 400), itemCount, reason };
}

async function main(): Promise<void> {
  console.log('=== Test 1: 7-day window (현재 fetch-youtube.ts 와 동일) ===');
  for (const q of queries) {
    const r = await rawSearch(q, 7);
    console.log(`[${r.status}] "${q}" → items=${r.itemCount}${r.reason ? ` reason=${r.reason}` : ''}`);
    if (r.status !== 200) console.log(`  body: ${r.bodySnippet}`);
  }

  console.log('\n=== Test 2: 30-day window (NVDA 만) ===');
  const r2 = await rawSearch('NVDA stock analysis', 30);
  console.log(`[${r2.status}] items=${r2.itemCount}${r2.reason ? ` reason=${r2.reason}` : ''}`);
  if (r2.status !== 200) console.log(`  body: ${r2.bodySnippet}`);

  console.log('\n=== Test 3: videoDuration 제거 (모든 길이 허용) ===');
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('q', 'NVDA stock analysis');
  url.searchParams.set('maxResults', '10');
  url.searchParams.set('order', 'relevance');
  url.searchParams.set('publishedAfter', new Date(Date.now() - 7 * 86400000).toISOString());
  url.searchParams.set('key', API_KEY!);
  const res3 = await fetch(url.toString());
  const text3 = await res3.text();
  console.log(`[${res3.status}] body: ${text3.slice(0, 400)}`);
}

main().catch(err => {
  console.error('실패:', err);
  process.exit(1);
});
