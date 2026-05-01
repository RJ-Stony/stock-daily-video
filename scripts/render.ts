import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { DailyData } from '../src/types';

export async function renderDaily(data: DailyData): Promise<string> {
  const entryPoint = path.resolve('src/index.ts');
  const serveUrl = await bundle({ entryPoint });

  const composition = await selectComposition({
    serveUrl,
    id: 'Daily',
    inputProps: data,
  });

  const outDir = path.resolve('out');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${data.date}.mp4`);

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outPath,
    inputProps: data,
  });

  return outPath;
}
