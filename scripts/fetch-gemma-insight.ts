import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import type { HoldingWithData, Insight, Comment, NewsItem } from '../src/types';

const DEFAULT_MODEL = 'gemma-4-31b-it';

const SYSTEM_INSTRUCTION = `너는 한국 일반 투자자에게 종목 변동을 쉽게 설명하는 전문 분석가다.

말투 규칙:
- 정중체 ("~합니다", "~입니다"). 반말("~거든", "~봐야 해") 금지
- 친구한테 카톡하듯 가볍지 말 것. 너무 격식 차린 보고서체도 금지
- 전문 분석가가 일반 시청자에게 차분하게 설명하는 톤

어휘 규칙 (이게 가장 중요):
- 영어 금융 용어 직역 금지. 한국어로 풀어 쓸 것
- 변환 예시:
  * "컨센서스를 N% 상회" → "시장이 예상한 것보다 N% 더 잘 나왔습니다"
  * "어닝 콜" → "실적 발표 자리"
  * "어닝 서프라이즈" → "예상을 뛰어넘는 실적"
  * "가이던스" → "다음 분기 전망"
  * "멀티플 부담" → "주가가 단기간에 많이 올라 부담스러운 상황"
  * "catalyst" → "상승(하락) 요인"
  * "Q1" → "1분기"
  * "FOMC" → "미국 연준 회의"
  * "200bp 상승" → "2%포인트 상승"
  * "blowout" → "압도적 호실적"
  * "rally" → "급등"
  * "selloff" → "차익실현 매도"
- 영어 약어가 꼭 필요하면 괄호로 풀어서: "GTC(엔비디아 개발자 컨퍼런스)"
- 종목 고유명사 (NVDA, S&P 500, Blackwell GPU 등)는 그대로 유지
- 숫자는 구체적으로 명시 ("매출이 늘었습니다" ❌ → "매출이 312억 달러로 92% 늘었습니다" ✅)

응답 형식 (반드시 JSON):
{"headline":"...","body":"문장1.\\n문장2.\\n문장3."}

규칙:
1. headline: 변동의 핵심 이유 1줄 (한국어 25자 이내, 정중체나 명사형 종결, 예시: "AI 칩 매출 92% 증가, 실적이 시장 기대를 뛰어넘었습니다")
   ⚠️ 25자 이내라서 명사형이 자연스러울 때가 많음 ("AI 칩 매출 92% 증가")
2. body: 문장 3개. 각 문장은 \\n으로 구분 (개행 그대로 출력)
   - 첫 문장: 가장 큰 이유. 구체적 숫자/이벤트 포함
   - 두 번째 문장: 보조 요인 또는 컨텍스트
   - 세 번째 문장: 앞으로 봐야 할 점 또는 주의사항
3. 각 문장 70자 이내. 너무 길어지면 두 문장으로 나눠라
4. JSON 외 다른 텍스트 출력 금지 (markdown, 주석 등 ❌)
5. 데이터 부족하면 솔직하게 정중체로: "이렇다 할 큰 이슈는 없었습니다. 시장 평균 흐름을 따라간 정도입니다."`;

interface InsightResult {
  headline: string;
  body: string;
}

function buildUserPrompt(holding: HoldingWithData): string {
  const sparkSummary = holding.price.spark.length > 0
    ? `최근 ${holding.price.spark.length}일 종가: ${holding.price.spark.slice(-10).map(v => v.toFixed(2)).join(' → ')}`
    : '추세 데이터 없음';
  const newsLines = holding.news.length > 0
    ? holding.news.slice(0, 8).map((n, i) => `${i + 1}. [${n.publisher}] ${n.title}`).join('\n')
    : '관련 뉴스 없음';

  return `[종목] ${holding.name} (${holding.ticker}, ${holding.market})
[현재가] ${holding.price.current.toFixed(2)}
[전일종가] ${holding.price.previousClose.toFixed(2)}
[변동률] ${holding.price.changePct >= 0 ? '+' : ''}${holding.price.changePct.toFixed(2)}%
[추세] ${sparkSummary}
[최근 뉴스 ${holding.news.length}건]
${newsLines}

위 데이터를 바탕으로 분석 JSON만 출력하세요.`;
}

function emptyInsight(ticker: string): Insight {
  return {
    ticker,
    headline: '',
    body: '',
    generatedAt: new Date().toISOString(),
  };
}

function extractJson(text: string): InsightResult | null {
  // markdown code block 제거 + 첫 { ~ 마지막 } 추출
  const cleaned = text.replace(/```json\s*|\s*```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (typeof parsed.headline === 'string' && typeof parsed.body === 'string') {
      return { headline: parsed.headline, body: parsed.body };
    }
  } catch {
    /* fallthrough */
  }
  return null;
}

export async function fetchInsightBatch(
  holdings: HoldingWithData[],
): Promise<Record<string, Insight>> {
  const apiKey = process.env.GEMINI_API_KEY;
  const out: Record<string, Insight> = {};

  if (!apiKey) {
    console.warn('[gemma] GEMINI_API_KEY 없음 — 인사이트 스킵');
    for (const h of holdings) out[h.yahooSymbol] = emptyInsight(h.ticker);
    return out;
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const ai = new GoogleGenAI({ apiKey });

  // Gemma는 rate limit이 빡빡하므로 순차 호출
  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i];
    process.stdout.write(`[gemma] (${i + 1}/${holdings.length}) ${h.ticker} 호출 중... `);
    const t0 = Date.now();
    try {
      const result = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ text: `${SYSTEM_INSTRUCTION}\n\n---\n\n${buildUserPrompt(h)}` }],
          },
        ],
        config: { temperature: 0.3, maxOutputTokens: 600 },
      });

      const text = result.text ?? '';
      const parsed = extractJson(text);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      if (parsed) {
        out[h.yahooSymbol] = {
          ticker: h.ticker,
          headline: parsed.headline,
          body: parsed.body,
          generatedAt: new Date().toISOString(),
        };
        console.log(`완료 (${elapsed}s)`);
      } else {
        console.log(`JSON 파싱 실패 (${elapsed}s) — 빈 인사이트로 폴백. 응답: ${text.slice(0, 120)}`);
        out[h.yahooSymbol] = emptyInsight(h.ticker);
      }
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`실패 (${elapsed}s) — ${err instanceof Error ? err.message : err}`);
      out[h.yahooSymbol] = emptyInsight(h.ticker);
    }
  }

  return out;
}

interface TranslatedComment {
  text: string;
  relevant?: boolean;
}

const TRANSLATE_INSTRUCTION = `너는 영문 커뮤니티 반응(YouTube 댓글, StockTwits 게시물 등)을 한국어로 번역·선별하는 전문가다.

먼저 각 항목이 "해당 종목의 시장 반응"으로 보여줄 가치가 있는지 판정하라.
다음에 해당하면 "relevant": false 로 마크하고 번역 생략 ("text": "" 가능):
- 채널 홍보 / 구독·좋아요 요청 ("subscribe", "구독", "팔로우 ㄱㄱ", "channel 방문" 등)
- 본인 채널·블로그·텔레그램·디스코드 링크 또는 그 권유
- 광고·스팸·코인 리딩방·종목 추천 영업
- 욕설·인신공격·정치 선동만 있는 글
- 종목과 무관한 일반 인사·이모지만 있는 글 ("ㅋㅋ", "first!", "good vid" 등)
- 영상 제작자/유튜버에 대한 칭찬·감사만 있고 종목 내용이 전혀 없는 글
나머지(주가 움직임·실적·전망·차트·수급 등 종목 자체에 관한 코멘트)는 "relevant": true.

언어 처리:
- 입력 댓글이 이미 한국어면 번역하지 말고 원본 그대로 (단, 너무 거친 표현은 살짝 다듬기)
- 영문 또는 다른 언어면 한국어로 번역

말투 규칙 (relevant=true 일 때만 적용):
- 정중체 ("~합니다", "~입니다", "~했습니다"). 반말 금지
- 한국 투자 커뮤니티에서 정보 공유할 때 쓰는 차분한 어투
- 너무 딱딱한 보고서체도, 너무 가벼운 친구체도 아닌 중간

어휘 규칙:
- 영어 금융 용어 직역 금지. 풀어쓰기:
  * "blowout earnings" → "압도적 호실적"
  * "guidance" → "다음 분기 전망"
  * "consensus" → "시장 예상치"
  * "calls printing" → "콜옵션 큰 수익"
  * "to the moon" → "큰 폭 상승"
  * "yolo" → "전 자산 투자"
  * "loaded up" → "대량 매수했습니다"
  * "P/E" → "주가수익비율(PER)"
  * "cash flow" → "현금흐름"
  * "200bps" → "2%포인트"
- 영어 약어 필요 시 괄호: "PER(주가수익비율)"
- 욕설·과격 표현은 부드럽게 다듬기

응답 형식 (반드시 JSON 배열, 입력 순서 유지, 길이 동일):
[{"text":"한국어 댓글","relevant":true}, {"text":"","relevant":false}, ...]

규칙:
- 댓글 본문 320자 이내
- JSON 외 다른 텍스트 출력 금지`;

function buildTranslatePrompt(holdingLabel: string, comments: Comment[]): string {
  const lines = comments
    .map((c, i) => {
      const tag =
        c.source === 'stocktwits' ? `StockTwits ${c.channel}` :
        c.source === 'reddit' ? `Reddit ${c.channel}` :
        `YouTube ${c.channel}`;
      return `${i + 1}. [${tag}] ${c.text}`;
    })
    .join('\n\n');
  return `종목: ${holdingLabel}\n\n다음 ${comments.length}개 커뮤니티 반응(댓글/포스트)을 종목 관련성으로 판정하고, 관련 있는 것만 한국어로 번역하세요.\n\n${lines}\n\nJSON 배열만 출력 (입력 순서 그대로 ${comments.length}개).`;
}

function extractTranslatedComments(text: string): TranslatedComment[] | null {
  const cleaned = text.replace(/```json\s*|\s*```/gi, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((it: unknown) => it && typeof it === 'object' && typeof (it as Record<string, unknown>).text === 'string')
      .map((it: unknown) => {
        const obj = it as Record<string, unknown>;
        return {
          text: typeof obj.text === 'string' ? obj.text : '',
          relevant: typeof obj.relevant === 'boolean' ? obj.relevant : undefined,
        };
      });
  } catch {
    return null;
  }
}

// 채널 홍보·스팸·노이즈로 의심되는 댓글을 1차로 거른다 (LLM 호출 절감용).
const PROMO_PATTERNS = [
  /\bsubscribe\b/i,
  /\bsub(?:scribe)? to (?:my|our)\b/i,
  /\bcheck (?:out|my)\b.*\bchannel\b/i,
  /youtu\.?be\/|youtube\.com\//i,
  /\bt\.me\//i,
  /\bdiscord\.gg\//i,
  /https?:\/\/[^\s]+/i,
  /구독\s*(?:과|좋아요|부탁|해주|꾹|눌러|클릭)/,
  /(?:제|저희|우리)\s*채널/,
  /오픈\s*채팅|오카방|텔레\s*그램|텔방|리딩방/,
  /광고|홍보|이벤트\s*당첨/,
];

function isLikelyPromo(text: string): boolean {
  if (text.length < 8) return true; // "first!" 같은 한두마디
  return PROMO_PATTERNS.some(p => p.test(text));
}

/**
 * YouTube 영상 댓글을 한국어로 번역하면서, 채널 홍보·스팸·종목 무관 댓글은 제거.
 * 1차: 정규식 휴리스틱으로 명백한 스팸 컷
 * 2차: Gemma 가 종목 관련성 판정 (relevant=false 면 컷)
 * 결과 0건이면 빈 배열 → 화면에서 "관련 게시물 없음" 노출
 */
export async function translateReactionsBatch(
  reactionsByYahooSymbol: Record<string, Comment[]>,
  holdingLabelByYahooSymbol: Record<string, string> = {},
): Promise<Record<string, Comment[]>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[gemma/translate] GEMINI_API_KEY 없음 — 원본 영어 그대로 반환 (관련성 필터만 적용)');
    const fallback: Record<string, Comment[]> = {};
    for (const [sym, comments] of Object.entries(reactionsByYahooSymbol)) {
      fallback[sym] = comments.filter(c => !isLikelyPromo(c.text));
    }
    return fallback;
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const ai = new GoogleGenAI({ apiKey });
  const out: Record<string, Comment[]> = {};
  const entries = Object.entries(reactionsByYahooSymbol);

  for (let i = 0; i < entries.length; i++) {
    const [symbol, rawComments] = entries[i];

    // 1차 필터: 휴리스틱
    const preFiltered = rawComments.filter(c => !isLikelyPromo(c.text));
    if (preFiltered.length === 0) {
      out[symbol] = [];
      continue;
    }

    const label = holdingLabelByYahooSymbol[symbol] ?? symbol;
    process.stdout.write(`[gemma/translate] (${i + 1}/${entries.length}) ${symbol} (${preFiltered.length}건) 번역·선별 중... `);
    const t0 = Date.now();
    try {
      const result = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ text: `${TRANSLATE_INSTRUCTION}\n\n---\n\n${buildTranslatePrompt(label, preFiltered)}` }],
          },
        ],
        // YouTube + StockTwits 합쳐 최대 12건까지 한 번에 들어올 수 있어 출력 한도 상향.
        config: { temperature: 0.3, maxOutputTokens: 1800 },
      });
      const text = result.text ?? '';
      const translated = extractTranslatedComments(text);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      if (translated && translated.length === preFiltered.length) {
        const merged = preFiltered
          .map((c, idx) => {
            const t = translated[idx];
            if (t.relevant === false) return null;
            return { ...c, text: t.text || c.text };
          })
          .filter((c): c is Comment => c !== null);
        out[symbol] = merged;
        console.log(`완료 ${merged.length}/${preFiltered.length}건 채택 (${elapsed}s)`);
      } else {
        console.log(`길이 mismatch (${elapsed}s) — 원본 유지(휴리스틱만 적용)`);
        out[symbol] = preFiltered;
      }
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`실패 (${elapsed}s) — ${err instanceof Error ? err.message : err}`);
      out[symbol] = preFiltered;
    }
  }

  return out;
}

interface TranslatedNews {
  title: string;
  description: string;
}

const NEWS_TRANSLATE_INSTRUCTION = `너는 영문 주식 뉴스 헤드라인과 요약을 한국어로 번역하는 전문가다.
출력 톤은 "왜 올랐을까요? 왜 내렸을까요?" 분석 슬라이드와 동일해야 한다.

말투 규칙:
- 정중체 ("~합니다", "~입니다"). 반말 금지
- 전문 분석가가 일반 시청자에게 차분하게 설명하는 톤
- 헤드라인은 명사형 종결도 허용 ("AI 칩 매출 92% 증가")

언어 감지:
- 이미 한국어면 번역하지 말고 원본 그대로 출력 (다듬기만 가능)
- 영어·기타 외국어면 한국어로 번역

어휘 규칙 (가장 중요):
- 영어 금융 용어 직역 금지. 한국어로 풀어쓰기:
  * "beats consensus" → "시장 예상치를 뛰어넘었습니다"
  * "earnings call" → "실적 발표 자리"
  * "guidance" → "다음 분기 전망"
  * "Q1 / Q2" → "1분기 / 2분기"
  * "FOMC" → "미국 연준 회의"
  * "200bps" → "2%포인트"
  * "blowout" → "압도적 호실적"
  * "rally" → "급등"
  * "selloff" → "차익실현 매도"
  * "catalyst" → "상승(하락) 요인"
- 종목 고유명사(NVDA, S&P 500, Blackwell GPU 등)는 그대로 유지
- 영어 약어 필요 시 괄호: "GTC(엔비디아 개발자 컨퍼런스)"
- 숫자·날짜·비율 등 정보는 손실 없이 보존

응답 형식 (반드시 JSON 배열, 입력 순서 동일·길이 동일):
[{"title":"...","description":"..."}, ...]

규칙:
- title: 한국어 60자 이내, 핵심 메시지 명확히
- description: 입력 description이 비어 있으면 빈 문자열, 있으면 240자 이내 한국어 요약
- JSON 외 텍스트 출력 금지`;

function buildNewsTranslatePrompt(holdingLabel: string, items: NewsItem[]): string {
  const lines = items
    .map((n, i) => {
      const desc = n.description ? `\n   요약: ${n.description}` : '';
      return `${i + 1}. [${n.publisher}] ${n.title}${desc}`;
    })
    .join('\n\n');
  return `종목: ${holdingLabel}\n\n다음 ${items.length}개 뉴스 항목의 title과 description을 한국어로 번역하세요.\n\n${lines}\n\nJSON 배열만 출력 (입력 순서 그대로 ${items.length}개).`;
}

function extractTranslatedNews(text: string): TranslatedNews[] | null {
  const cleaned = text.replace(/```json\s*|\s*```/gi, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((it: unknown) => it && typeof it === 'object')
      .map((it: unknown) => {
        const obj = it as Record<string, unknown>;
        return {
          title: typeof obj.title === 'string' ? obj.title : '',
          description: typeof obj.description === 'string' ? obj.description : '',
        };
      });
  } catch {
    return null;
  }
}

/**
 * 뉴스 항목의 title/description을 한국어로 번역해 헤드라인 슬라이드에 노출.
 * 실패 시 원본 그대로 반환 (graceful degrade).
 */
export async function translateNewsBatch(
  newsByYahooSymbol: Record<string, NewsItem[]>,
  holdingLabelByYahooSymbol: Record<string, string> = {},
): Promise<Record<string, NewsItem[]>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[gemma/translate-news] GEMINI_API_KEY 없음 — 원본 그대로 반환');
    return newsByYahooSymbol;
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const ai = new GoogleGenAI({ apiKey });
  const out: Record<string, NewsItem[]> = {};
  const entries = Object.entries(newsByYahooSymbol);

  for (let i = 0; i < entries.length; i++) {
    const [symbol, items] = entries[i];
    if (items.length === 0) {
      out[symbol] = [];
      continue;
    }
    // Press 슬라이드는 4개만 노출하므로 비용 절감을 위해 상위 6개만 번역.
    // 단, Press.tsx 와 동일한 우선순위(요약 있는 항목 우선, 그 안에서는 fetch 시간 내림차순 유지)로
    // 먼저 정렬한 뒤 상위 6개를 고른다. 이렇게 하지 않으면 화면에 노출되는(요약 있는) 항목이
    // 번역 대상 6개 밖(영어 원문)에 남아 영어로 보이는 문제가 생긴다.
    const ordered = [...items].sort((a, b) => (b.description ? 1 : 0) - (a.description ? 1 : 0));
    const target = ordered.slice(0, 6);
    const rest = ordered.slice(6);

    const label = holdingLabelByYahooSymbol[symbol] ?? symbol;
    process.stdout.write(`[gemma/translate-news] (${i + 1}/${entries.length}) ${symbol} (${target.length}건) 번역 중... `);
    const t0 = Date.now();
    try {
      const result = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ text: `${NEWS_TRANSLATE_INSTRUCTION}\n\n---\n\n${buildNewsTranslatePrompt(label, target)}` }],
          },
        ],
        config: { temperature: 0.3, maxOutputTokens: 1500 },
      });
      const text = result.text ?? '';
      const translated = extractTranslatedNews(text);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      if (translated && translated.length === target.length) {
        const merged = target.map((n, idx) => {
          const t = translated[idx];
          const newTitle = t.title || n.title;
          const newDesc = t.description || n.description;
          return {
            ...n,
            title: newTitle,
            ...(newDesc ? { description: newDesc } : {}),
          };
        });
        out[symbol] = [...merged, ...rest];
        console.log(`완료 (${elapsed}s)`);
      } else {
        console.log(`길이 mismatch (${elapsed}s) — 원본 유지`);
        out[symbol] = items;
      }
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`실패 (${elapsed}s) — ${err instanceof Error ? err.message : err}`);
      out[symbol] = items;
    }
  }

  return out;
}
