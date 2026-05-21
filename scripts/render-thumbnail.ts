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

  // render.ts와 동일 — 클라우드 컨테이너 SSL 인증서 검증 우회.
  // browserExecutable: remotion.media 다운로드가 차단되는 클라우드 환경에서 시스템 Chromium 사용.
  const chromiumOptions = { ignoreCertificateErrors: true };
  const browserExecutable =
    process.env.REMOTION_CHROME_EXECUTABLE ??
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const chromeMode = 'chrome-for-testing' as const;

  const composition = await selectComposition({
    serveUrl,
    id: 'Daily',
    inputProps: data,
    chromiumOptions,
    browserExecutable,
    chromeMode,
  });

  const outDir = path.resolve('out');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${data.date}-thumb.jpg`);

  await renderStill({
    composition,
    serveUrl,
    output: outPath,
    frame: 30,
    imageFormat: 'jpeg',
    jpegQuality: 90,
    inputProps: data,
    chromiumOptions,
    browserExecutable,
    chromeMode,
  });

  return outPath;
}
