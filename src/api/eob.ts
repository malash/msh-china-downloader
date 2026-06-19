import { fetchWithSign } from '../client.js';

export interface EobFileInfo {
  picUrl: string;
  url: string;
}

// EOB images are generated lazily: the static file 404s until this endpoint is
// called for the claim. Returns the image (picUrl) and PDF (url) URLs, or null
// if this claim has no EOB.
export const getEobFileInfo = async (claimNo: string): Promise<EobFileInfo | null> => {
  const { success, result } = await fetchWithSign<{
    success: string;
    result?: EobFileInfo;
  }>('/appwechat/ob/getEobFileInfo', { claimNo, flag: 'app' });

  if (success !== 't' || !result?.picUrl) return null;
  return result;
};
