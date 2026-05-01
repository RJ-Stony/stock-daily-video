import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { colors, type, space, radius } from '../styles/tokens';
import type { HoldingWithData } from '../types';

export const Outro: React.FC<{ holdings: HoldingWithData[] }> = ({ holdings }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const avg = holdings.length > 0
    ? holdings.reduce((s, h) => s + h.price.changePct, 0) / holdings.length
    : 0;
  const avgFormatted = `${avg >= 0 ? '+' : ''}${avg.toFixed(2)}%`;

  const big = spring({ frame, fps, config: { damping: 14 } });
  const sub = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: 'clamp' });
  const cta = interpolate(frame, [22, 40], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.canvasParchment,
        padding: space.section,
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          ...type.heroDisplay,
          color: avg >= 0 ? colors.primary : colors.ink,
          marginBottom: space.md,
          transform: `scale(${0.94 + big * 0.06})`,
          opacity: big,
        }}
      >
        {avgFormatted}
      </div>
      <div style={{ ...type.lead, color: colors.inkMuted80, marginBottom: space.xxl, opacity: sub }}>
        보유 {holdings.length}종목 평균
      </div>
      <div style={{ ...type.tagline, color: colors.ink, marginBottom: space.xl, opacity: sub }}>
        내일 08:00 KST에 다시 만나요
      </div>
      <div
        style={{
          ...type.body,
          backgroundColor: colors.primary,
          color: colors.onPrimary,
          padding: '11px 22px',
          borderRadius: radius.pill,
          opacity: cta,
        }}
      >
        Notion에서 종목 관리
      </div>
    </AbsoluteFill>
  );
};
