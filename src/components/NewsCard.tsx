import { useCurrentFrame, interpolate } from 'remotion';
import { colors, type, space, radius } from '../styles/tokens';
import type { NewsItem } from '../types';

interface Props {
  item: NewsItem;
  delay: number;
}

export const NewsCard: React.FC<Props> = ({ item, delay }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateRight: 'clamp' });
  const ty = interpolate(frame, [delay, delay + 10], [16, 0], { extrapolateRight: 'clamp' });

  const ageHours = Math.max(0, (Date.now() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60));
  const ageLabel = ageHours < 1 ? '방금 전' : ageHours < 24 ? `${Math.floor(ageHours)}시간 전` : `${Math.floor(ageHours / 24)}일 전`;

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        border: `1px solid ${colors.hairline}`,
        borderRadius: radius.lg,
        padding: space.xl,
        display: 'flex',
        flexDirection: 'column',
        gap: space.md,
        opacity,
        transform: `translateY(${ty}px)`,
      }}
    >
      <div style={{ ...type.captionStrong, color: colors.primary, letterSpacing: '1px', textTransform: 'uppercase' }}>
        {item.publisher}
      </div>
      <div
        style={{
          ...type.bodyStrong,
          color: colors.ink,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 3,
          overflow: 'hidden',
        }}
      >
        {item.title}
      </div>
      {item.description ? (
        <div
          style={{
            ...type.body,
            color: colors.inkMuted80,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 12,
            overflow: 'hidden',
            flex: 1,
          }}
        >
          {item.description}
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}
      <div style={{ ...type.caption, color: colors.inkMuted48, marginTop: 'auto' }}>{ageLabel}</div>
    </div>
  );
};
