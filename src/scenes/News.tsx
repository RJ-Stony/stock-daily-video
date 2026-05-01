import { AbsoluteFill } from 'remotion';
import { colors, type, space } from '../styles/tokens';
import type { NewsItem } from '../types';

// TODO(milestone-2): 통합 뉴스 다이제스트 신 — 모든 종목 헤드라인을 한 화면에 모아서 표시
export const News: React.FC<{ items: NewsItem[] }> = ({ items }) => (
  <AbsoluteFill
    style={{
      backgroundColor: colors.canvasParchment,
      padding: space.section,
      justifyContent: 'center',
    }}
  >
    <div style={{ ...type.displayLg, color: colors.ink, marginBottom: space.xl }}>오늘의 헤드라인</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.md }}>
      {items.map((n, i) => (
        <div key={i}>
          <div style={{ ...type.caption, color: colors.inkMuted48 }}>{n.publisher}</div>
          <div style={{ ...type.body, color: colors.ink }}>{n.title}</div>
        </div>
      ))}
    </div>
  </AbsoluteFill>
);
