import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { colors, type, space } from '../styles/tokens';
import { NewsCard } from '../components/NewsCard';
import type { EnrichedHolding } from '../types';

export const Press: React.FC<{ holding: EnrichedHolding }> = ({ holding }) => {
  const frame = useCurrentFrame();
  const headerOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const headerTy = interpolate(frame, [0, 10], [12, 0], { extrapolateRight: 'clamp' });

  // description이 있는 항목을 우선 노출 — 제목만 있고 본문이 비는 카드(공백 카드) 방지.
  // 1차 정렬은 fetch 단계에서 시간 내림차순으로 끝났으므로 stable sort로 우선순위만 추가한다.
  const items = [...holding.news]
    .sort((a, b) => (b.description ? 1 : 0) - (a.description ? 1 : 0))
    .slice(0, 4);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.canvasParchment, padding: space.xxl, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space.lg, opacity: headerOpacity, transform: `translateY(${headerTy}px)` }}>
        <div style={{ ...type.displayLg, color: colors.ink }}>오늘의 헤드라인</div>
        <div style={{ ...type.caption, color: colors.inkMuted48 }}>{holding.name}</div>
      </div>

      {items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', ...type.lead, color: colors.inkMuted48 }}>
          최근 뉴스 없음
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: space.lg, overflow: 'hidden' }}>
          {items.map((item, i) => (
            <NewsCard key={item.link + i} item={item} delay={5 + i * 5} />
          ))}
          {/* 4개 미만일 때 빈 슬롯 placeholder */}
          {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
            <div
              key={`placeholder-${i}`}
              style={{
                flex: 1,
                backgroundColor: colors.canvas,
                border: `1px dashed ${colors.hairline}`,
                borderRadius: 18,
                opacity: 0.4,
              }}
            />
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};
