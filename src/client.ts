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

// Recursively replace null with '' — the server normalizes the body this way
// before verifying the signature, so a request carrying a literal null is rejected.
const nullClean = (value: unknown): unknown => {
  if (value === null) return '';
  if (Array.isArray(value)) return value.map(nullClean);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, nullClean(v)]),
    );
  }
  return value;
};

// ASCII-sort the top-level keys. The server canonicalizes the body the same way
// before recomputing the HMAC, so an unsorted body fails signature verification.
const sortAscii = (obj: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

export const fetchWithSign = async <T = unknown>(
  path: string,
  payload: unknown = {},
): Promise<T> => {
  // Sign and send the SAME canonicalized body the server expects.
  const cleaned = nullClean(payload);
  const canonical =
    cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned)
      ? sortAscii(cleaned as Record<string, unknown>)
      : cleaned;
  const body = JSON.stringify(canonical);
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
