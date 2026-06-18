import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getClaimDetail, type Rider } from '../api/claim.js';
import type { ClaimSummary } from '../api/claim-list.js';
import { downloadImages, downloadOptional } from './images.js';
import { renderHtml, renderMarkdown } from './render.js';

const EOB_BASE = 'https://wechat.mshasia.com/image/upfile/uploadfile/EobPath/rider/MshBat/APP/image';

// 病历, 原始发票/收据, 费用明细 first; everything else keeps its original order after.
const RIDER_ORDER = ['BST00003', 'BST00002', 'BST00005'];

const sortRiders = (riders: Rider[]): Rider[] => {
  const rank = (r: Rider) => {
    const i = RIDER_ORDER.indexOf(r.riderType);
    return i === -1 ? RIDER_ORDER.length : i;
  };
  return riders.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map((x) => x.r);
};

const sanitize = (s: string): string => s.replace(/[/\\:*?"<>|\s]/g, '_');

// Saves the claim into `${claimsDir}/${name}/${date}_${claimNo}/` and returns
// the `${name}/${date}_${claimNo}` path relative to claimsDir.
export const downloadClaim = async (
  summary: ClaimSummary,
  personName: string,
  claimsDir: string,
): Promise<string> => {
  const claim = await getClaimDetail(summary.claimNo, summary.employeeId);

  const relPath = join(sanitize(personName), sanitize(`${summary.startDate}_${claim.claimNo}`));
  const dir = join(claimsDir, relPath);
  const imagesDir = join(dir, 'images');
  await mkdir(imagesDir, { recursive: true });

  const images = await downloadImages(sortRiders(claim.riderInfoReturn), imagesDir);
  const eob = await downloadOptional(`${EOB_BASE}/${claim.claimNo}.jpg`, imagesDir, 'eob');

  await Promise.all([
    writeFile(join(dir, 'detail.json'), JSON.stringify(claim, null, 2)),
    writeFile(join(dir, 'claim.md'), renderMarkdown(claim, images, eob)),
    writeFile(join(dir, 'index.html'), renderHtml(claim, images, eob)),
  ]);

  return relPath;
};
