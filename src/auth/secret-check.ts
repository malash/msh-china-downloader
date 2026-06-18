import { done, warn } from '../log.js';

const WEB_URL = 'https://wechat.mshasia.com/wechat/';

// The secret is split across two string literals in the bundle, so the full value
// never appears verbatim. Probe the head and tail substrings instead.
export const checkSignatureSecret = async (secret: string): Promise<void> => {
  if (!secret) {
    throw new Error('Missing SIGNATURE_SECRET environment variable (set it in .env)');
  }
  try {
    const html = await (await fetch(WEB_URL, { signal: AbortSignal.timeout(15000) })).text();

    const match = html.match(/static\/js\/app\.[a-f0-9]+\.js/);
    if (!match) {
      warn('Could not locate app.js; skipping SIGNATURE_SECRET check.');
      return;
    }

    const js = await (
      await fetch(`${WEB_URL}${match[0]}`, { signal: AbortSignal.timeout(15000) })
    ).text();

    const head = secret.slice(0, 30);
    const tail = secret.slice(-20);
    if (js.includes(head) && js.includes(tail)) {
      done('SIGNATURE_SECRET is up to date');
    } else {
      warn('SIGNATURE_SECRET not found in the latest app.js — it may have changed.');
    }
  } catch (error) {
    warn(`SIGNATURE_SECRET check skipped (${(error as Error).message}).`);
  }
};
