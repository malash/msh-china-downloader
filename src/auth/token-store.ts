import { readFile, writeFile } from 'node:fs/promises';

const TOKEN_FILE = new URL('../../.token', import.meta.url);

const isExpired = (jwt: string, skewSeconds = 60): boolean => {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.exp !== 'number' || payload.exp - skewSeconds <= Date.now() / 1000;
  } catch {
    return true;
  }
};

export const readToken = async (): Promise<string | null> => {
  let jwt: string;
  try {
    jwt = (await readFile(TOKEN_FILE, 'utf8')).trim();
  } catch {
    return null;
  }
  return jwt && !isExpired(jwt) ? jwt : null;
};

export const writeToken = (jwt: string): Promise<void> => writeFile(TOKEN_FILE, jwt, 'utf8');
