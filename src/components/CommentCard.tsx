import { useCurrentFrame, interpolate } from 'remotion';
import { colors, type, space, radius } from '../styles/tokens';
import type { Comment } from '../types';

interface Props {
  comment: Comment;
  delay: number;
}

// 소스별 배지 아이콘 — 시장 반응 출처를 한눈에 구분.
const SOURCE_ICON: Record<Comment['source'], string> = {
  youtube: '📺',
  reddit: '👥',
  stocktwits: '💬',
};
const LIKE_ICON: Record<Comment['source'], string> = {
  youtube: '❤️',
  reddit: '⬆️',
  stocktwits: '👥', // StockTwits는 좋아요 대신 작성자 팔로워 수를 노출
};

export const CommentCard: React.FC<Props> = ({ comment, delay }) => {
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
        <span style={{ ...type.captionStrong, color: colors.primaryOnDark }}>
          {SOURCE_ICON[comment.source]} {comment.channel}
        </span>
        <span style={{ ...type.caption, color: colors.bodyMuted }}>·</span>
        <span style={{ ...type.caption, color: colors.bodyMuted }}>
          {LIKE_ICON[comment.source]} {comment.likeCount.toLocaleString()}
        </span>
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
        {comment.text}
      </div>
    </div>
  );
};
