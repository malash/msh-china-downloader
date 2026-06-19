import { createHmac, randomUUID } from 'node:crypto';

const BASE_URL = 'https://wechat.mshasia.com';

let token = 'null';

export const setToken = (value: string): void => {
  token = value;
};

// HMAC-SHA256 over `${timestamp}&${nonce}&${body}${query}`. For POST the query is
// the literal "{}", concatenated to the body with NO separator (easy to get wrong).
const sign = (timestamp: string, nonce: string, body: string, query = '{}'): string => {
  const secret = process.env.SIGNATURE_SECRET;
  if (!secret) {
    throw new Error('Missing SIGNATURE_SECRET environment variable (set it in .env)');
  }
  return createHmac('sha256', secret).update(`${timestamp}&${nonce}&${body}${query}`).digest('hex');
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
