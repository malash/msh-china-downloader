import { copyFile, mkdir, rename, rm } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createHash, randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Rider } from '../api/claim.js';
import { sanitize } from '../util.js';

export interface DownloadedImage {
  rider: Rider;
  file: string;
}

// Lives inside output/ but survives `yarn clean`, whose glob explicitly excludes it.
const CACHE_DIR = fileURLToPath(new URL('../../output/.cache/', import.meta.url));

const extFromContentType = (contentType: string | null, url: string): string => {
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';
  if (contentType?.includes('pdf')) return 'pdf';
  const fromUrl = url.split('.').pop()?.toLowerCase();
  return fromUrl && fromUrl.length <= 4 ? fromUrl : 'bin';
};

// URL extension → the ext extFromContentType yields for it (the server's content-type always
// matches the URL extension), so a cache hit gets the same file name without a request.
const CACHEABLE_EXT = new Map([
  ['png', 'png'],
  ['jpg', 'jpg'],
  ['jpeg', 'jpg'],
  ['pdf', 'pdf'],
]);

const TIMEOUT_MS = 30000;
const RETRIES = 3;

// Streams url to the path `target(ext)` returns. Returns that path, or null on 404 (missing optional file).
const fetchFile = async (url: string, target: (ext: string) => string): Promise<string | null> => {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.status === 404) return null;
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const path = target(extFromContentType(response.headers.get('content-type'), url));
      await pipeline(response.body, createWriteStream(path));
      return path;
    } catch (error) {
      if (attempt >= RETRIES) {
        throw new Error(`Failed to download ${url}: ${(error as Error).message}`);
      }
    }
  }
};

// Downloads url into dir as `${name}.${ext}`. Returns the file name, or null on 404.
const downloadFile = async (url: string, dir: string, name: string): Promise<string | null> => {
  const path = await fetchFile(url, ext => join(dir, `${name}.${ext}`));
  return path && basename(path);
};

// Like downloadFile, but goes through CACHE_DIR, keyed by URL hash. Attachment URLs are treated as
// immutable (each upload gets a fresh random file name); delete output/.cache to force a refetch.
// Each claim still gets its own copy, keeping claim folders independent of each other and the cache.
const downloadCached = async (url: string, dir: string, name: string): Promise<string | null> => {
  const ext = CACHEABLE_EXT.get(new URL(url).pathname.split('.').pop()!.toLowerCase());
  if (!ext) return downloadFile(url, dir, name);

  const hash = createHash('sha256').update(url).digest('hex');
  const cachePath = join(CACHE_DIR, `${hash}.${ext}`);
  if (!existsSync(cachePath)) {
    await mkdir(CACHE_DIR, { recursive: true });
    // Unique temp name: concurrent claims may share an attachment. Rename only once complete,
    // so an interrupted download never leaves a truncated file in the cache.
    const tmp = `${cachePath}.${randomUUID()}.tmp`;
    try {
      if (!(await fetchFile(url, () => tmp))) return null;
      await rename(tmp, cachePath);
    } finally {
      await rm(tmp, { force: true });
    }
  }

  const file = `${name}.${ext}`;
  await copyFile(cachePath, join(dir, file));
  return file;
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

    const file = await downloadCached(rider.riderPath, dir, name);
    if (file) images.push({ rider, file });
  }
  return images;
};

// Not cached: EOBs are regenerated on every getEobFileInfo call, so their content changes.
export const downloadOptional = async (
  url: string,
  dir: string,
  name: string,
): Promise<string | null> => {
  await mkdir(dir, { recursive: true });
  return downloadFile(url, dir, name);
};
