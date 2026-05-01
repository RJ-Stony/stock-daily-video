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
  const chromiumOptions = { ignoreCertificateErrors: true };

  const composition = await selectComposition({
    serveUrl,
    id: 'Daily',
    inputProps: data,
    chromiumOptions,
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
  });

  return outPath;
}
