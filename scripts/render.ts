import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { DailyData } from '../src/types';

export async function renderDaily(data: DailyData): Promise<string> {
  const entryPoint = path.resolve('src/index.ts');
  const serveUrl = await bundle({ entryPoint });

  // 클라우드 컨테이너 환경에 시스템 CA 번들이 없어 fonts.gstatic.com 등 일부 호스트의
  // SSL 인증서를 신뢰하지 못하는 케이스 — Chromium에 인증서 검증 우회 옵션을 전달.
  // browserExecutable: remotion.media 다운로드가 차단되는 클라우드 환경에서 시스템 Chromium 사용.
  const chromiumOptions = { ignoreCertificateErrors: true };
  // chrome-for-testing(--headless=new) 모드 + Playwright 풀 Chrome 사용:
  // headless_shell 바이너리에서는 FontFace JS API 로 폰트를 로드할 때 hang 발생.
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
  const outPath = path.join(outDir, `${data.date}.mp4`);

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outPath,
    inputProps: data,
    chromiumOptions,
    browserExecutable,
    chromeMode,
    // 클라우드 환경에서 http2 번들 서버가 동시 접속 4개 이상에서 fetch hang 발생 →
    // concurrency 1로 Chrome 탭을 순차 실행하여 회피.
    concurrency: 1,
  });

  return outPath;
}
