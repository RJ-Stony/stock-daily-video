import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'node:fs/promises';

function getR2Client(): { client: S3Client; bucket: string; publicBaseUrl: string } | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucket, publicBaseUrl: publicBaseUrl.replace(/\/$/, '') };
}

/**
 * 로컬 파일을 R2에 업로드하고 public URL을 반환한다.
 * R2 환경변수가 모두 채워지지 않은 경우 file:// URL fallback (graceful degrade).
 */
export async function uploadFile(
  localPath: string,
  key: string,
  contentType: string,
): Promise<string> {
  const r2 = getR2Client();
  if (!r2) {
    console.warn('[upload] R2 환경변수 미설정 — file:// URL 반환');
    return `file://${localPath.replace(/\\/g, '/')}`;
  }

  try {
    const body = await readFile(localPath);
    await r2.client.send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    const publicUrl = `${r2.publicBaseUrl}/${key}`;
    console.log(`[upload] uploaded → ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error('[upload] R2 업로드 실패', err instanceof Error ? err.message : err);
    return `file://${localPath.replace(/\\/g, '/')}`;
  }
}
