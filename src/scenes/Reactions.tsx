import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { colors, type, space } from '../styles/tokens';
import { CommentCard } from '../components/CommentCard';
import type { EnrichedHolding } from '../types';

export const Reactions: React.FC<{ holding: EnrichedHolding }> = ({ holding }) => {
  const frame = useCurrentFrame();
  const headerOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const headerTy = interpolate(frame, [0, 10], [12, 0], { extrapolateRight: 'clamp' });

  const items = holding.reactions.slice(0, 5);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.surfaceTile1,
        padding: space.xxl,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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
        <div style={{ ...type.displayLg, color: colors.bodyOnDark }}>시장 반응</div>
        <div style={{ ...type.caption, color: colors.bodyMuted }}>{holding.name}</div>
      </div>

      {items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', ...type.lead, color: colors.bodyMuted }}>
          관련 게시물 없음
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: space.md, justifyContent: 'center' }}>
          {items.map((p, i) => (
            <CommentCard key={`${p.videoId}-${i}`} comment={p} delay={5 + i * 6} />
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};
