import { mkdir, writeFile } from 'node:fs/promises';
import type { Rider } from '../api/claim.js';
import { sanitize } from '../util.js';

export interface DownloadedImage {
  rider: Rider;
  file: string;
}

const extFromContentType = (contentType: string | null, url: string): string => {
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';
  if (contentType?.includes('pdf')) return 'pdf';
  const fromUrl = url.split('.').pop()?.toLowerCase();
  return fromUrl && fromUrl.length <= 4 ? fromUrl : 'bin';
};

const TIMEOUT_MS = 30000;
const RETRIES = 3;

interface SavedFile {
  file: string;
  ext: string;
}

// Downloads url into dir as `${name}.${ext}`. Returns null on 404 (missing optional file).
const downloadFile = async (url: string, dir: string, name: string): Promise<SavedFile | null> => {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = extFromContentType(response.headers.get('content-type'), url);
      await writeFile(`${dir}/${name}.${ext}`, buffer);
      return { file: `${name}.${ext}`, ext };
    } catch (error) {
      if (attempt >= RETRIES) {
        throw new Error(`Failed to download ${url}: ${(error as Error).message}`);
      }
    }
  }
};

export const downloadImages = async (riders: Rider[], dir: string): Promise<DownloadedImage[]> => {
  await mkdir(dir, { recursive: true });

  const images: DownloadedImage[] = [];
  const used = new Map<string, number>();
  let unknown = 0;
  for (const rider of riders) {
    let name = sanitize(rider.riderTypeName);
    if (!name) {
      unknown += 1;
      name = `UNKNOWN${unknown === 1 ? '' : unknown}`;
    } else {
      const seen = used.get(name) ?? 0;
      used.set(name, seen + 1);
      if (seen > 0) name = `${name}_${seen + 1}`;
    }

    const saved = await downloadFile(rider.riderPath, dir, name);
    if (saved) images.push({ rider, file: saved.file });
  }
  return images;
};

export const downloadOptional = async (
  url: string,
  dir: string,
  name: string,
): Promise<string | null> => {
  await mkdir(dir, { recursive: true });
  const saved = await downloadFile(url, dir, name);
  return saved?.file ?? null;
};
