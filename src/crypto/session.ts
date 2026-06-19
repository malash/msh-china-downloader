import { fetchWithSign } from '../client.js';
import { buildSession, generateUuid, type Session } from './cipher.js';

// The uuid is a ONE-SHOT nonce for /claim/detail — reusing a session for a second
// detail call yields `-999999999 非法请求`. So every claim detail must negotiate
// its own session; don't cache and reuse.
export const negotiateSession = async (): Promise<Session> => {
  const uuid = generateUuid();
  const { result } = await fetchWithSign<{ result: string[] }>('/appwechat/com/separated/ra', {
    uuid,
  });
  if (!Array.isArray(result) || result.length < 6) {
    throw new Error('Key negotiation failed: unexpected /separated/ra response');
  }
  return buildSession(uuid, result);
};
