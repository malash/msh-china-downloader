import { randomUUID } from 'node:crypto';
import { sign } from '../crypto/sign.js';
import { buildSession, type Session } from '../crypto/cipher.js';

const BASE_URL = 'https://wechat.mshasia.com';

let token = 'null';

export const setToken = (value: string): void => {
  token = value;
};

export const fetchWithSign = async <T = unknown>(
  path: string,
  payload: unknown = {},
): Promise<T> => {
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const nonce = randomUUID().replace('-', '');

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      Token: token,
      nonce,
      signature: sign(timestamp, nonce, body),
      timestamp,
    },
    body,
    redirect: 'follow',
  });

  return response.json() as Promise<T>;
};

export const negotiateSession = async (uuid: string): Promise<Session> => {
  const { result } = await fetchWithSign<{ result: string[] }>('/appwechat/com/separated/ra', {
    uuid,
  });
  if (!Array.isArray(result) || result.length < 6) {
    throw new Error('Key negotiation failed: unexpected /separated/ra response');
  }
  return buildSession(result);
};
