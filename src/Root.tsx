import { Composition } from 'remotion';
import { loadLocalFonts } from './fonts';
import { Daily } from './Daily';
import type { DailyData } from './types';

loadLocalFonts();

const SAMPLE_DAILY_DATA: DailyData = {
  date: '2026-05-01',
  holdings: [
    {
      id: 'sample-1',
      ticker: 'NVDA',
      name: '엔비디아 (NVDA)',
      market: 'US',
      yahooSymbol: 'NVDA',
      tags: ['Tech', 'Semiconductor'],
      active: true,
      price: { ticker: 'NVDA', current: 142.5, previousClose: 138.2, changePct: 3.11, spark: [130, 132, 135, 138, 140, 138, 141, 142.5] },
      news: [
        {
          ticker: 'NVDA',
          title: 'NVIDIA 1분기 실적 시장 예상치 뛰어넘어 — AI 칩 매출 92% 증가',
          publisher: 'Bloomberg',
          link: 'https://example.com/1',
          publishedAt: '2026-05-01T08:00:00Z',
          description: '엔비디아가 1분기 매출 312억 달러로 시장이 예상한 것보다 14% 더 잘 나왔습니다. AI 데이터센터 부문 매출이 1년 전보다 92% 늘어나며 실적을 견인했고, 차세대 Blackwell GPU 공급 부족으로 가격 협상력이 강해졌습니다.',
        },
        {
          ticker: 'NVDA',
          title: 'AI 데이터센터 수요 폭증, Blackwell 공급 부족 1년 더 이어질 전망',
          publisher: '한국경제',
          link: 'https://example.com/2',
          publishedAt: '2026-05-01T07:00:00Z',
          description: '대형 클라우드 사업자들의 AI 인프라 투자가 본격화되며 엔비디아 차세대 칩이 향후 12개월간 공급 부족 상태를 유지할 전망입니다. 대만 TSMC의 패키징 공정이 병목으로 지목됩니다.',
        },
        {
          ticker: 'NVDA',
          title: '젠슨 황 CEO, 차세대 GPU 출시 일정 6개월 앞당겨',
          publisher: 'CNBC',
          link: 'https://example.com/3',
          publishedAt: '2026-05-01T06:00:00Z',
          description: '젠슨 황 CEO는 실적 발표 자리에서 차세대 Rubin GPU의 양산 일정을 기존보다 6개월 앞당긴다고 발표했습니다. 다음 GTC(엔비디아 개발자 컨퍼런스)에서 추가 정보가 공개될 예정입니다.',
        },
        {
          ticker: 'NVDA',
          title: '엔비디아, 한국 클라우드 파트너십 확장',
          publisher: '연합뉴스',
          link: 'https://example.com/4',
          publishedAt: '2026-05-01T05:00:00Z',
          description: '네이버클라우드와 KT클라우드가 엔비디아 Blackwell 기반 AI 인프라 도입을 확대합니다. 국내 대형 언어 모델 학습 수요 증가에 대응하기 위한 조치입니다.',
        },
      ],
      insight: {
        ticker: 'NVDA',
        headline: 'AI 칩 매출 92% 증가, 시장 기대 압도',
        body: '1분기 매출이 시장이 예상한 것보다 14% 더 잘 나왔습니다. AI 데이터센터 부문 매출이 1년 전보다 92% 늘어난 것이 결정적이었습니다.\n젠슨 황 CEO가 실적 발표에서 차세대 Rubin GPU 양산 일정을 6개월 앞당긴다고 발표한 점도 주가에 긍정적으로 작용했습니다.\n다만 주가가 단기간에 많이 올라 부담스러운 수준입니다. 다음 엔비디아 개발자 컨퍼런스(GTC)가 추가 상승 요인이 될지 지켜볼 만합니다.',
        generatedAt: '2026-05-01T08:30:00Z',
      },
      videos: [
        {
          ticker: 'NVDA', videoId: 'sample-vid-1',
          title: '엔비디아 1분기 실적 분석 — 왜 92% 성장했나',
          channel: '슈카월드', thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          publishedAt: '2026-04-30T12:00:00Z', viewCount: 124000, durationSec: 720,
        },
        {
          ticker: 'NVDA', videoId: 'sample-vid-2',
          title: 'NVDA 차트 기술적 분석 — 142달러 저항선 돌파',
          channel: '주식왕TV', thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          publishedAt: '2026-04-29T18:00:00Z', viewCount: 56000, durationSec: 540,
        },
        {
          ticker: 'NVDA', videoId: 'sample-vid-3',
          title: 'NVIDIA Q1 Earnings Deep Dive: AI Capex Cycle',
          channel: 'Wall Street Lunch', thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          publishedAt: '2026-04-30T20:00:00Z', viewCount: 230000, durationSec: 1080,
        },
      ],
      reactions: [
        {
          ticker: 'NVDA', source: 'youtube',
          channel: '슈카월드',
          videoTitle: '엔비디아 1분기 실적 분석 — 왜 92% 성장했나',
          videoId: 'sample-vid-1',
          author: '시청자A',
          text: '데이터센터 매출이 1년 전보다 92% 늘었다는 게 정말 놀랍습니다. 영상 내용처럼 다음 분기 전망도 시장 예상보다 8% 더 높게 나왔네요.',
          likeCount: 1842,
          publishedAt: '2026-04-30T15:00:00Z',
        },
        {
          ticker: 'NVDA', source: 'youtube',
          channel: '주식왕TV',
          videoTitle: 'NVDA 차트 기술적 분석 — 142달러 저항선 돌파',
          videoId: 'sample-vid-2',
          author: 'StockFan99',
          text: '142달러 저항선 돌파한 게 차트상으로 확실한 매수 신호로 보입니다. 거래량도 평소보다 훨씬 많이 나왔고요.',
          likeCount: 982,
          publishedAt: '2026-04-29T20:00:00Z',
        },
        {
          ticker: 'NVDA', source: 'youtube',
          channel: 'Wall Street Lunch',
          videoTitle: 'NVIDIA Q1 Earnings Deep Dive: AI Capex Cycle',
          videoId: 'sample-vid-3',
          author: '한국투자자',
          text: '주가수익비율(PER)이 높긴 하지만 성장률이 그것을 정당화한다고 봅니다. 현금흐름 창출 능력에서 따라올 회사가 거의 없습니다.',
          likeCount: 412,
          publishedAt: '2026-04-30T22:00:00Z',
        },
        {
          ticker: 'NVDA', source: 'youtube',
          channel: '슈카월드',
          videoTitle: '엔비디아 1분기 실적 분석 — 왜 92% 성장했나',
          videoId: 'sample-vid-1',
          author: 'AI워치',
          text: '하이퍼스케일러 투자 사이클이 2027년까지는 이어질 것으로 보입니다. 단기 조정은 있을 수 있지만 큰 추세는 변하지 않을 것 같습니다.',
          likeCount: 387,
          publishedAt: '2026-04-30T16:30:00Z',
        },
        {
          ticker: 'NVDA', source: 'youtube',
          channel: 'Wall Street Lunch',
          videoTitle: 'NVIDIA Q1 Earnings Deep Dive: AI Capex Cycle',
          videoId: 'sample-vid-3',
          author: '미장러',
          text: '실적도 좋지만 차세대 Rubin GPU 양산 일정 앞당김이 장기적으로 더 중요한 신호입니다. 경쟁사 대비 격차가 더 벌어질 가능성이 큽니다.',
          likeCount: 256,
          publishedAt: '2026-04-30T23:00:00Z',
        },
      ],
    },
    {
      id: 'sample-2',
      ticker: 'SPYM',
      name: 'SPYM',
      market: 'US',
      yahooSymbol: 'SPYM',
      tags: ['Index'],
      active: true,
      price: { ticker: 'SPYM', current: 78.42, previousClose: 78.85, changePct: -0.55, spark: [76, 77, 78.5, 79, 78.8, 79.1, 78.85, 78.42] },
      news: [
        {
          ticker: 'SPYM',
          title: 'S&P 500, 기술주 약세에 혼조 마감',
          publisher: 'Reuters',
          link: 'https://example.com/5',
          publishedAt: '2026-05-01T08:00:00Z',
          description: 'S&P 500 지수가 0.55% 하락 마감했습니다. 대형 기술주에서 차익실현 매도 물량이 나오며 나스닥 100 지수가 0.8% 빠졌고, 금융주는 강보합권을 유지했습니다.',
        },
        {
          ticker: 'SPYM',
          title: '미국 연준 금리 인하 기대 후퇴, 채권 수익률 상승',
          publisher: '매일경제',
          link: 'https://example.com/6',
          publishedAt: '2026-05-01T07:00:00Z',
          description: '시장이 예상하던 6월 미국 연준 회의에서의 금리 인하 확률이 75%에서 52%로 후퇴했습니다. 10년 만기 미국 국채 수익률이 4.5%까지 반등하며 주식 가치 평가에 부담을 주었습니다.',
        },
        {
          ticker: 'SPYM',
          title: 'SPDR Portfolio S&P 500 ETF 운용보수 0.02% 동결',
          publisher: 'ETF Stream',
          link: 'https://example.com/7',
          publishedAt: '2026-04-30T12:00:00Z',
          description: '운용사 State Street가 SPYM(구 SPLG)의 운용보수를 0.02%로 유지한다고 발표했습니다. 동일한 S&P 500 노출을 가진 SPY 대비 약 1/15 수준입니다.',
        },
      ],
      insight: {
        ticker: 'SPYM',
        headline: '기술주 차익실현 매도에 지수 미세 조정',
        body: '대형 기술주에서 차익실현 매도가 나오며 0.55% 하락했습니다. 큰 이슈라기보다는 단기 숨고르기 흐름으로 해석됩니다.\n6월 미국 연준 회의에서의 금리 인하 기대가 75%에서 52%로 후퇴한 점도 부담이었습니다. 10년 만기 미국 국채 수익률이 4.5%까지 반등했기 때문입니다.\nSPYM 자체 자금 유입은 견조한 편이라 이 정도 조정을 큰 추세 변화로 보기는 어렵습니다.',
        generatedAt: '2026-05-01T08:30:00Z',
      },
      videos: [
        {
          ticker: 'SPYM', videoId: 'sample-vid-4',
          title: 'S&P 500 인덱스 ETF 비교 — SPY vs SPYM vs VOO',
          channel: '존리의 부자될결심', thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          publishedAt: '2026-04-28T15:00:00Z', viewCount: 89000, durationSec: 900,
        },
      ],
      reactions: [
        {
          ticker: 'SPYM', source: 'youtube',
          channel: '존리의 부자될결심',
          videoTitle: 'S&P 500 인덱스 ETF 비교 — SPY vs SPYM vs VOO',
          videoId: 'sample-vid-4',
          author: '인덱스러버',
          text: 'SPY와 동일한 S&P 500 노출을 가지면서 운용보수는 약 1/15 수준입니다. 개인연금 계좌를 모두 SPYM으로 전환했습니다.',
          likeCount: 234,
          publishedAt: '2026-04-29T10:00:00Z',
        },
        {
          ticker: 'SPYM', source: 'youtube',
          channel: '존리의 부자될결심',
          videoTitle: 'S&P 500 인덱스 ETF 비교 — SPY vs SPYM vs VOO',
          videoId: 'sample-vid-4',
          author: '장기투자',
          text: 'SPDR이 SPLG를 SPYM으로 리브랜딩한 건 단순히 종목 코드만 바뀐 것입니다. 펀드 자산도, 운용보수도 동일합니다.',
          likeCount: 156,
          publishedAt: '2026-04-29T11:00:00Z',
        },
        {
          ticker: 'SPYM', source: 'youtube',
          channel: '존리의 부자될결심',
          videoTitle: 'S&P 500 인덱스 ETF 비교 — SPY vs SPYM vs VOO',
          videoId: 'sample-vid-4',
          author: '연금러',
          text: '30년 장기 투자 기준으로 운용보수 차이가 누적 수익률에 큰 차이를 만듭니다. 동일 노출이라면 저비용 ETF가 항상 정답입니다.',
          likeCount: 142,
          publishedAt: '2026-04-29T12:00:00Z',
        },
        {
          ticker: 'SPYM', source: 'youtube',
          channel: '존리의 부자될결심',
          videoTitle: 'S&P 500 인덱스 ETF 비교 — SPY vs SPYM vs VOO',
          videoId: 'sample-vid-4',
          author: '매크로러',
          text: '6월 미국 연준 회의 결과에 따라 단기 변동성이 커질 수 있습니다. 분할 매수 전략이 안전해 보입니다.',
          likeCount: 98,
          publishedAt: '2026-04-29T13:00:00Z',
        },
        {
          ticker: 'SPYM', source: 'youtube',
          channel: '존리의 부자될결심',
          videoTitle: 'S&P 500 인덱스 ETF 비교 — SPY vs SPYM vs VOO',
          videoId: 'sample-vid-4',
          author: '세금절감',
          text: '과세 계좌라면 SPY에서 SPYM으로 전환할 때 자본이득세 발생 가능성을 고려해야 합니다. 개인연금 계좌라면 부담 없이 전환할 수 있습니다.',
          likeCount: 76,
          publishedAt: '2026-04-29T14:00:00Z',
        },
      ],
    },
  ],
};

export const Root: React.FC = () => (
  <Composition
    id="Daily"
    component={Daily}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={SAMPLE_DAILY_DATA}
    calculateMetadata={async ({ props }) => ({
      // 모든 장표를 150프레임(5초)으로 고정. intro + (A,B,C,D,E)*n + outro = (5n + 2) * 150
      durationInFrames: 150 * (props.holdings.length * 5 + 2),
      props,
    })}
  />
);
