import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getClaimDetail, type Rider } from '../api/claim.js';
import type { ClaimSummary } from '../api/claim-list.js';
import { getEobFileInfo } from '../api/eob.js';
import { downloadImages, downloadOptional } from './images.js';
import { renderHtml, renderMarkdown } from './render.js';
import { sanitize, toRelativeUrl } from '../util.js';

// 病历, 原始发票/收据, 费用明细 first; everything else keeps its original order after.
const RIDER_ORDER = ['BST00003', 'BST00002', 'BST00005'];

const sortRiders = (riders: Rider[]): Rider[] => {
  const rank = (r: Rider) => {
    const i = RIDER_ORDER.indexOf(r.riderType);
    return i === -1 ? RIDER_ORDER.length : i;
  };
  return riders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
    .map(x => x.r);
};

// Saves the claim into `${claimsDir}/${name}/${date}_${claimNo}/` and returns
// the `${name}/${date}_${claimNo}` path relative to claimsDir.
export const downloadClaim = async (
  summary: ClaimSummary,
  personName: string,
  claimsDir: string,
): Promise<string> => {
  const claim = await getClaimDetail(summary.claimNo, summary.employeeId);

  const segments = [sanitize(personName), sanitize(`${summary.startDate}_${claim.claimNo}`)];
  const dir = join(claimsDir, ...segments);
  const imagesDir = join(dir, 'images');
  await mkdir(imagesDir, { recursive: true });

  const images = await downloadImages(sortRiders(claim.riderInfoReturn), imagesDir);

  // EOB is generated on demand: getEobFileInfo triggers it and returns the
  // image + PDF URLs. Download both — the page shows the image, links to the PDF.
  const eobInfo = await getEobFileInfo(claim.claimNo);
  const eob = eobInfo && {
    image: await downloadOptional(eobInfo.picUrl, imagesDir, 'eob'),
    pdf: await downloadOptional(eobInfo.url, imagesDir, 'eob-pdf'),
  };

  await Promise.all([
    writeFile(join(dir, 'detail.json'), JSON.stringify(claim, null, 2)),
    writeFile(join(dir, 'claim.md'), renderMarkdown(claim, images, eob)),
    writeFile(join(dir, 'index.html'), renderHtml(claim, images, eob)),
  ]);

  return toRelativeUrl(segments);
};
