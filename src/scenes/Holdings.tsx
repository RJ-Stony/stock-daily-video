import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { colors, type, space, radius, productShadow } from '../styles/tokens';
import type { HoldingWithData } from '../types';

interface Props {
  holding: HoldingWithData;
  index: number;
  total: number;
  isDark: boolean;
}

export const HoldingScene: React.FC<Props> = ({ holding, index, total, isDark }) => {
  const frame = useCurrentFrame();
  // 2초(60프레임) 안에 모든 요소가 등장하도록 stagger 절반으로 단축
  const fade = (start: number, end: number) =>
    interpolate(frame, [start, end], [0, 1], { extrapolateRight: 'clamp' });
  const slide = (start: number, end: number) =>
    interpolate(frame, [start, end], [16, 0], { extrapolateRight: 'clamp' });

  const bg = isDark ? colors.surfaceTile1 : colors.canvas;
  const textColor = isDark ? colors.bodyOnDark : colors.ink;
  const labelColor = isDark ? colors.bodyMuted : colors.inkMuted48;
  // 한국 관례: 오르면 빨강, 내리면 파랑
  const isGain = holding.price.changePct >= 0;
  const accentBg = isGain
    ? isDark ? colors.gainRedOnDark : colors.gainRed
    : isDark ? colors.lossBlueOnDark : colors.lossBlue;
  const sparkStroke = accentBg;

  const positionLabel = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  const priceFormatted = holding.price.current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const changeFormatted = `${holding.price.changePct >= 0 ? '+' : ''}${holding.price.changePct.toFixed(2)}%`;

  // 스파크라인 SVG 좌표 계산
  const sparkW = 600;
  const sparkH = 200;
  const spark = holding.price.spark.length > 0 ? holding.price.spark : [0];
  const minV = Math.min(...spark);
  const maxV = Math.max(...spark);
  const range = maxV - minV || 1;
  const points = spark
    .map((v, i) => {
      const x = (i / Math.max(spark.length - 1, 1)) * sparkW;
      const y = sparkH - ((v - minV) / range) * sparkH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        display: 'flex',
        flexDirection: 'row',
        padding: space.section,
        gap: space.section,
      }}
    >
      {/* 좌측 패널 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          style={{
            ...type.captionStrong,
            color: labelColor,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            marginBottom: space.lg,
            opacity: fade(0, 12),
            transform: `translateY(${slide(0, 12)}px)`,
          }}
        >
          {positionLabel}
        </div>
        <div
          style={{
            ...type.displayLg,
            color: textColor,
            marginBottom: space.md,
            opacity: fade(4, 18),
            transform: `translateY(${slide(4, 18)}px)`,
          }}
        >
          {holding.name}
        </div>
        <div style={{ marginBottom: space.xl, opacity: fade(8, 22), transform: `translateY(${slide(8, 22)}px)` }}>
          <span
            style={{
              ...type.captionStrong,
              backgroundColor: isDark ? colors.surfaceTile3 : colors.canvasParchment,
              color: textColor,
              padding: '6px 14px',
              borderRadius: radius.pill,
              letterSpacing: '1px',
            }}
          >
            {holding.ticker} · {holding.market}
          </span>
        </div>
        <div
          style={{
            ...type.displayMd,
            color: textColor,
            marginBottom: space.lg,
            opacity: fade(12, 26),
            transform: `translateY(${slide(12, 26)}px)`,
          }}
        >
          {holding.market === 'US' ? `$${priceFormatted}` : `₩${priceFormatted}`}
        </div>
        <div style={{ opacity: fade(16, 30), transform: `translateY(${slide(16, 30)}px)` }}>
          <span
            style={{
              ...type.bodyStrong,
              backgroundColor: accentBg,
              color: colors.onPrimary,
              padding: '8px 18px',
              borderRadius: radius.pill,
            }}
          >
            {changeFormatted}
          </span>
        </div>
      </div>

      {/* 우측 패널 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          style={{
            backgroundColor: isDark ? colors.surfaceTile2 : colors.surfacePearl,
            borderRadius: radius.lg,
            padding: space.lg,
            marginBottom: space.xl,
            boxShadow: productShadow,
            opacity: fade(10, 28),
          }}
        >
          <svg width={sparkW} height={sparkH} viewBox={`0 0 ${sparkW} ${sparkH}`}>
            <polyline
              fill="none"
              stroke={sparkStroke}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.md }}>
          {holding.news.slice(0, 1).map((item, i) => (
            <div
              key={item.link + i}
              style={{
                opacity: fade(18, 32),
                transform: `translateY(${slide(18, 32)}px)`,
              }}
            >
              <div style={{ ...type.caption, color: labelColor, marginBottom: 4 }}>{item.publisher}</div>
              <div style={{ ...type.body, color: textColor }}>{item.title}</div>
            </div>
          ))}
          {holding.news.length === 0 && (
            <div style={{ ...type.caption, color: labelColor }}>최근 뉴스 없음</div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
