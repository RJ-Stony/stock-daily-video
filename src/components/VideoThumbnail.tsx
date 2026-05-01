import { Img, useCurrentFrame, interpolate } from 'remotion';
import { colors, type, space, radius, productShadow } from '../styles/tokens';
import type { YouTubeVideo } from '../types';

interface Props {
  video: YouTubeVideo;
  delay: number;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const VideoThumbnail: React.FC<Props> = ({ video, delay }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateRight: 'clamp' });
  const ty = interpolate(frame, [delay, delay + 10], [20, 0], { extrapolateRight: 'clamp' });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: space.sm, opacity, transform: `translateY(${ty}px)` }}>
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 9',
          borderRadius: radius.lg,
          overflow: 'hidden',
          boxShadow: productShadow,
          backgroundColor: colors.surfacePearl,
        }}
      >
        <Img
          src={video.thumbnailUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute',
            right: space.sm,
            bottom: space.sm,
            backgroundColor: 'rgba(0,0,0,0.78)',
            color: colors.onDark,
            ...type.captionStrong,
            padding: '4px 10px',
            borderRadius: radius.sm,
          }}
        >
          {formatDuration(video.durationSec)}
        </div>
      </div>
      <div style={{ ...type.captionStrong, color: colors.primary, letterSpacing: '0.5px' }}>{video.channel}</div>
      <div
        style={{
          ...type.bodyStrong,
          color: colors.ink,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          overflow: 'hidden',
        }}
      >
        {video.title}
      </div>
    </div>
  );
};
