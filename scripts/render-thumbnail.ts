import { bundle } from '@remotion/bundler';
import { selectComposition, renderStill } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { DailyData } from '../src/types';

/**
 * Daily 컴포지션의 인트로 1초 시점(frame 30) 정지 이미지를 jpg로 추출.
 * 카카오 feed 템플릿의 image_url로 사용된다.
 */
export async function renderThumbnail(data: DailyData): Promise<string> {
  const entryPoint = path.resolve('src/index.ts');
  const serveUrl = await bundle({ entryPoint });

  const composition = await selectComposition({
    serveUrl,
    id: 'Daily',
    inputProps: data,
  });

  const outDir = path.resolve('out');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${data.date}-thumb.jpg`);

  await renderStill({
    composition,
    serveUrl,
    output: outPath,
    frame: 30, // 인트로 1초 시점 (헤드라인 등장 완료)
    imageFormat: 'jpeg',
    jpegQuality: 90,
    inputProps: data,
  });

  return outPath;
}
