import { Series } from 'remotion';
import type { DailyData } from './types';
import { Intro } from './scenes/Intro';
import { HoldingScene } from './scenes/Holdings';
import { Press } from './scenes/Press';
import { Why } from './scenes/Why';
import { Videos } from './scenes/Videos';
import { Reactions } from './scenes/Reactions';
import { Outro } from './scenes/Outro';

const SCENE_FRAMES = 150;

export const Daily: React.FC<DailyData> = ({ date, holdings }) => (
  <Series>
    <Series.Sequence durationInFrames={SCENE_FRAMES}>
      <Intro date={date} />
    </Series.Sequence>
    {holdings.flatMap((h, i) => [
      <Series.Sequence key={`${h.id}-A`} durationInFrames={SCENE_FRAMES}>
        <HoldingScene holding={h} index={i} total={holdings.length} isDark={false} />
      </Series.Sequence>,
      <Series.Sequence key={`${h.id}-B`} durationInFrames={SCENE_FRAMES}>
        <Press holding={h} />
      </Series.Sequence>,
      <Series.Sequence key={`${h.id}-C`} durationInFrames={SCENE_FRAMES}>
        <Why holding={h} />
      </Series.Sequence>,
      <Series.Sequence key={`${h.id}-D`} durationInFrames={SCENE_FRAMES}>
        <Videos holding={h} />
      </Series.Sequence>,
      <Series.Sequence key={`${h.id}-E`} durationInFrames={SCENE_FRAMES}>
        <Reactions holding={h} />
      </Series.Sequence>,
    ])}
    <Series.Sequence durationInFrames={SCENE_FRAMES}>
      <Outro holdings={holdings} />
    </Series.Sequence>
  </Series>
);
