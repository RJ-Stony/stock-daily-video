import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { colors, type, space, radius } from '../styles/tokens';
import { VideoThumbnail } from '../components/VideoThumbnail';
import type { EnrichedHolding } from '../types';

export const Videos: React.FC<{ holding: EnrichedHolding }> = ({ holding }) => {
  const frame = useCurrentFrame();
  const headerOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const headerTy = interpolate(frame, [0, 10], [12, 0], { extrapolateRight: 'clamp' });

  const items = holding.videos.slice(0, 3);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.canvas, padding: space.xxl, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: space.lg,
          opacity: headerOpacity,
          transform: `translateY(${headerTy}px)`,
        }}
      >
        <div style={{ ...type.displayLg, color: colors.ink }}>추천 분석 영상</div>
        <div style={{ ...type.caption, color: colors.inkMuted48 }}>{holding.name}</div>
      </div>

      {items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', ...type.lead, color: colors.inkMuted48 }}>
          추천 영상 없음
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: space.xl, alignItems: 'center' }}>
          {items.map((v, i) => (
            <VideoThumbnail key={v.videoId} video={v} delay={3 + i * 6} />
          ))}
          {Array.from({ length: Math.max(0, 3 - items.length) }).map((_, i) => (
            <div
              key={`placeholder-${i}`}
              style={{
                flex: 1,
                backgroundColor: colors.surfacePearl,
                borderRadius: radius.lg,
                opacity: 0.5,
                aspectRatio: '16 / 9',
              }}
            />
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};
