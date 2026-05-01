import 'dotenv/config';
import { Client } from '@notionhq/client';
import { HoldingSchema, type Holding } from '../src/types';

interface NotionRichText {
  plain_text: string;
}
interface NotionTitle { title: NotionRichText[]; }
interface NotionRichTextProp { rich_text: NotionRichText[]; }
interface NotionSelect { select: { name: string } | null; }
interface NotionMultiSelect { multi_select: Array<{ name: string }>; }
interface NotionCheckbox { checkbox: boolean; }

function joinText(rt: NotionRichText[] | undefined): string {
  return (rt ?? []).map(t => t.plain_text).join('');
}

export async function fetchActiveHoldings(): Promise<Holding[]> {
  const apiKey = process.env.NOTION_API_KEY;
  // 호환: 새 이름 NOTION_PORTFOLIO_DB_ID 우선, 없으면 옛 이름도 허용
  const dbId = process.env.NOTION_PORTFOLIO_DB_ID ?? process.env.NOTION_PORTFOLIO_DS_ID;
  if (!apiKey) throw new Error('NOTION_API_KEY 환경변수가 비어있습니다');
  if (!dbId) throw new Error('NOTION_PORTFOLIO_DB_ID 환경변수가 비어있습니다');

  const client = new Client({ auth: apiKey });
  const res = await client.databases.query({
    database_id: dbId,
    filter: { property: 'Active', checkbox: { equals: true } },
  });

  const holdings: Holding[] = [];
  for (const page of res.results) {
    if (!('properties' in page)) continue;
    const props = page.properties as Record<string, unknown>;

    const name = joinText((props['Name'] as NotionTitle | undefined)?.title);
    const ticker = joinText((props['Ticker'] as NotionRichTextProp | undefined)?.rich_text);
    const yahooSymbol = joinText((props['Yahoo Symbol'] as NotionRichTextProp | undefined)?.rich_text);
    const marketName = (props['Market'] as NotionSelect | undefined)?.select?.name ?? 'US';
    const market = marketName === 'KR' ? 'KR' : 'US';
    const tags = ((props['Sector'] as NotionMultiSelect | undefined)?.multi_select ?? []).map(o => o.name);
    const active = (props['Active'] as NotionCheckbox | undefined)?.checkbox ?? false;

    const parsed = HoldingSchema.safeParse({
      id: page.id,
      ticker,
      name,
      market,
      yahooSymbol,
      tags,
      active,
    });
    if (parsed.success) {
      holdings.push(parsed.data);
    } else {
      console.warn('[fetch-notion] skipped invalid row', { id: page.id, err: parsed.error.flatten() });
    }
  }
  return holdings;
}

const isMain = (() => {
  try {
    const arg = process.argv[1];
    if (!arg) return false;
    return import.meta.url === new URL(`file:///${arg.replace(/\\/g, '/')}`).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  fetchActiveHoldings()
    .then(holdings => {
      console.log(JSON.stringify(holdings, null, 2));
      console.log(`\n[fetch-notion] ${holdings.length}개 종목 조회됨`);
    })
    .catch(err => {
      console.error('[fetch-notion] 실패:', err.message);
      process.exit(1);
    });
}
