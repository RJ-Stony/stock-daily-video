import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { colors, type, space } from '../styles/tokens';
import type { EnrichedHolding } from '../types';

export const Why: React.FC<{ holding: EnrichedHolding }> = ({ holding }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const headerSpring = spring({ frame: frame - 5, fps, config: { damping: 14 } });
  const insightHeadlineOpacity = interpolate(frame, [18, 36], [0, 1], { extrapolateRight: 'clamp' });
  const insightHeadlineTy = interpolate(frame, [18, 36], [16, 0], { extrapolateRight: 'clamp' });
  const bodyOpacity = interpolate(frame, [36, 60], [0, 1], { extrapolateRight: 'clamp' });
  const bodyTy = interpolate(frame, [36, 60], [16, 0], { extrapolateRight: 'clamp' });

  const isGain = holding.price.changePct >= 0;
  const accent = isGain ? colors.gainRedOnDark : colors.lossBlueOnDark;
  const headlineText = isGain ? '왜 올랐을까요?' : '왜 내렸을까요?';

  const hasInsight = holding.insight.body.length > 0 || holding.insight.headline.length > 0;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.surfaceTile1, padding: space.section, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div
        style={{
          ...type.captionStrong,
          color: colors.bodyMuted,
          letterSpacing: '4px',
          textTransform: 'uppercase',
          marginBottom: space.lg,
          opacity: labelOpacity,
        }}
      >
        Why · {holding.name}
      </div>
      <div
        style={{
          ...type.heroDisplay,
          color: colors.bodyOnDark,
          marginBottom: space.xxl,
          transform: `scale(${0.96 + headerSpring * 0.04})`,
          opacity: headerSpring,
        }}
      >
        {headlineText}
      </div>

      {hasInsight ? (
        <>
          {/* 인사이트 핵심 헤드라인 — 액센트 컬러 */}
          <div
            style={{
              ...type.displayMd,
              color: accent,
              marginBottom: space.xl,
              maxWidth: 1400,
              opacity: insightHeadlineOpacity,
              transform: `translateY(${insightHeadlineTy}px)`,
            }}
          >
            {holding.insight.headline}
          </div>
          {/* 본문 — 좌측 액센트 바로 묶고 문장별 분리. 한 문장은 반드시 한 줄에 들어가도록
              섹션 패딩(80*2=160) 제외 가용폭 1760에 맞춰 maxWidth/fontSize 조정. */}
          <div
            style={{
              borderLeft: `4px solid ${accent}`,
              paddingLeft: space.xl,
              maxWidth: 1760,
              display: 'flex',
              flexDirection: 'column',
              gap: space.md,
              opacity: bodyOpacity,
              transform: `translateY(${bodyTy}px)`,
            }}
          >
            {holding.insight.body
              .split(/(?<=[.!?])\s+/)              // 마침표/느낌표/물음표 뒤 공백 기준
              .map(s => s.trim())
              .filter(s => s.length > 0)
              .map((line, i) => (
                <div
                  key={i}
                  style={{
                    ...type.lead,
                    fontSize: 28,                   // 70자 한국어 문장이 한 줄에 들어가도록
                    color: colors.bodyOnDark,
                    lineHeight: 1.4,
                  }}
                >
                  {line}
                </div>
              ))}
          </div>
        </>
      ) : (
        <div
          style={{
            ...type.lead,
            color: colors.bodyMuted,
            opacity: bodyOpacity,
          }}
        >
          분석 데이터 없음
        </div>
      )}
    </AbsoluteFill>
  );
};
