import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import type { HoldingWithData, Insight, Comment } from '../src/types';

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
}

const TRANSLATE_INSTRUCTION = `너는 영문 YouTube 영상 댓글을 한국어로 번역하는 전문가다.

언어 감지 규칙 (가장 먼저 적용):
- 입력 댓글이 이미 한국어면 번역하지 말고 원본 그대로 출력
- 영문 또는 다른 언어면 한국어로 번역

말투 규칙:
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

응답 형식 (반드시 JSON 배열, 입력 순서 유지):
[{"text":"한국어 댓글"}, ...]

규칙:
- 댓글 본문 320자 이내
- JSON 외 다른 텍스트 출력 금지`;

function buildTranslatePrompt(comments: Comment[]): string {
  const lines = comments
    .map((c, i) => `${i + 1}. [${c.channel}] ${c.text}`)
    .join('\n\n');
  return `다음 ${comments.length}개 YouTube 영상 댓글을 한국어로 번역하세요.\n\n${lines}\n\nJSON 배열만 출력.`;
}

function extractJsonArray(text: string): TranslatedComment[] | null {
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
        };
      });
  } catch {
    return null;
  }
}

/**
 * YouTube 영상 댓글의 text를 한국어 친숙 어투로 번역.
 * 종목 단위로 batch 호출 (댓글 3개 한 번에).
 * 실패 시 원본 그대로 반환 (graceful degrade).
 */
export async function translateReactionsBatch(
  reactionsByYahooSymbol: Record<string, Comment[]>,
): Promise<Record<string, Comment[]>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[gemma/translate] GEMINI_API_KEY 없음 — 원본 영어 그대로 반환');
    return reactionsByYahooSymbol;
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const ai = new GoogleGenAI({ apiKey });
  const out: Record<string, Comment[]> = {};
  const entries = Object.entries(reactionsByYahooSymbol);

  for (let i = 0; i < entries.length; i++) {
    const [symbol, comments] = entries[i];
    if (comments.length === 0) {
      out[symbol] = [];
      continue;
    }
    process.stdout.write(`[gemma/translate] (${i + 1}/${entries.length}) ${symbol} (${comments.length}건) 번역 중... `);
    const t0 = Date.now();
    try {
      const result = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ text: `${TRANSLATE_INSTRUCTION}\n\n---\n\n${buildTranslatePrompt(comments)}` }],
          },
        ],
        config: { temperature: 0.3, maxOutputTokens: 1200 },
      });
      const text = result.text ?? '';
      const translated = extractJsonArray(text);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      if (translated && translated.length === comments.length) {
        out[symbol] = comments.map((c, idx) => ({
          ...c,
          text: translated[idx].text || c.text,
        }));
        console.log(`완료 (${elapsed}s)`);
      } else {
        console.log(`길이 mismatch (${elapsed}s) — 원본 유지`);
        out[symbol] = comments;
      }
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`실패 (${elapsed}s) — ${err instanceof Error ? err.message : err}`);
      out[symbol] = comments;
    }
  }

  return out;
}
