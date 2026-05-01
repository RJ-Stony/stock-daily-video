import { useCurrentFrame, interpolate } from 'remotion';
import { colors, type, space, radius } from '../styles/tokens';
import type { RedditPost } from '../types';

interface Props {
  post: RedditPost;
  delay: number;
}

export const RedditQuote: React.FC<Props> = ({ post, delay }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateRight: 'clamp' });
  const tx = interpolate(frame, [delay, delay + 10], [-20, 0], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderLeft: `4px solid ${colors.primaryOnDark}`,
        borderRadius: radius.md,
        padding: `${space.md}px ${space.lg}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: space.xs,
        opacity,
        transform: `translateX(${tx}px)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
        <span style={{ ...type.captionStrong, color: colors.primaryOnDark }}>r/{post.subreddit}</span>
        <span style={{ ...type.caption, color: colors.bodyMuted }}>·</span>
        <span style={{ ...type.caption, color: colors.bodyMuted }}>↑ {post.score.toLocaleString()}</span>
      </div>
      <div
        style={{
          ...type.bodyStrong,
          color: colors.bodyOnDark,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 1,
          overflow: 'hidden',
        }}
      >
        {post.title}
      </div>
      {post.excerpt && (
        <div
          style={{
            ...type.caption,
            color: colors.bodyMuted,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
          }}
        >
          {post.excerpt}
        </div>
      )}
    </div>
  );
};
