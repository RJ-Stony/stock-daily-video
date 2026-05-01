import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { colors, type, space } from '../styles/tokens';

export const Intro: React.FC<{ date: string }> = ({ date }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const headlineSpring = spring({ frame: frame - 8, fps, config: { damping: 14 } });
  const dateOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });

  const formatted = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(`${date}T00:00:00`));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.canvas,
        padding: space.section,
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          ...type.captionStrong,
          color: colors.inkMuted48,
          letterSpacing: '4px',
          textTransform: 'uppercase',
          marginBottom: space.lg,
          opacity: labelOpacity,
        }}
      >
        Portfolio Daily
      </div>
      <div
        style={{
          ...type.heroDisplay,
          color: colors.ink,
          marginBottom: space.lg,
          transform: `scale(${0.96 + headlineSpring * 0.04})`,
          opacity: headlineSpring,
        }}
      >
        오늘의 포트폴리오
      </div>
      <div
        style={{
          ...type.lead,
          color: colors.inkMuted80,
          opacity: dateOpacity,
        }}
      >
        {formatted}
      </div>
    </AbsoluteFill>
  );
};
