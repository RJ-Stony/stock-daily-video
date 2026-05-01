import { Series } from 'remotion';
import type { DailyData } from './types';
import { Intro } from './scenes/Intro';
import { HoldingScene } from './scenes/Holdings';
import { Press } from './scenes/Press';
import { Why } from './scenes/Why';
import { Videos } from './scenes/Videos';
import { Reactions } from './scenes/Reactions';
import { Outro } from './scenes/Outro';

export const Daily: React.FC<DailyData> = ({ date, holdings }) => (
  <Series>
    <Series.Sequence durationInFrames={90}>
      <Intro date={date} />
    </Series.Sequence>
    {holdings.flatMap((h, i) => [
      <Series.Sequence key={`${h.id}-A`} durationInFrames={60}>
        <HoldingScene holding={h} index={i} total={holdings.length} isDark={false} />
      </Series.Sequence>,
      <Series.Sequence key={`${h.id}-B`} durationInFrames={90}>
        <Press holding={h} />
      </Series.Sequence>,
      <Series.Sequence key={`${h.id}-C`} durationInFrames={150}>
        <Why holding={h} />
      </Series.Sequence>,
      <Series.Sequence key={`${h.id}-D`} durationInFrames={60}>
        <Videos holding={h} />
      </Series.Sequence>,
      <Series.Sequence key={`${h.id}-E`} durationInFrames={90}>
        <Reactions holding={h} />
      </Series.Sequence>,
    ])}
    <Series.Sequence durationInFrames={120}>
      <Outro holdings={holdings} />
    </Series.Sequence>
  </Series>
);
