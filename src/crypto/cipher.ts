import {
  constants,
  createCipheriv,
  createDecipheriv,
  createPublicKey,
  publicEncrypt,
  randomUUID,
  type KeyObject,
} from 'node:crypto';

export interface Session {
  uuid: string;
  publicKey: KeyObject;
  key: string;
  iv: string;
}

export const generateUuid = (): string => randomUUID().replace(/-/g, '');

const PUBKEY_MAP: Record<string, string> = {
  '!': '1',
  '@': '2',
  '#': '3',
  $: '4',
  '%': '5',
  '^': '6',
  '&': '7',
  '*': '8',
};

const deobfuscatePublicKey = (raw: string): KeyObject => {
  const odd = raw.length % 2 === 1;
  const tail = odd ? raw.slice(-1) : '';
  const s = odd ? raw.slice(0, -1) : raw;
  const replaced = s.replace(/[!@#$%^&*]/g, c => PUBKEY_MAP[c]);
  const mid = s.length / 2;
  const der = Buffer.from(replaced.slice(mid) + replaced.slice(0, mid) + tail, 'base64');
  return createPublicKey({ key: der, format: 'der', type: 'spki' });
};

const IV_MAP: Record<string, string> = { '@': 'W', '*': 'K', '!': '1' };
const KEY_MAP: Record<string, string> = { '#': 'W', '=': 'Y', $: '4' };

export const buildSession = (uuid: string, raResult: string[]): Session => ({
  uuid,
  publicKey: deobfuscatePublicKey(raResult[1]),
  iv: raResult[2].replace(/[@*!]/g, c => IV_MAP[c]),
  key: raResult[5].replace(/[#=$]/g, c => KEY_MAP[c]),
});

const aesDecrypt = (session: Session, ciphertextB64: string): string => {
  const decipher = createDecipheriv(
    'aes-128-cbc',
    Buffer.from(session.key, 'utf8'),
    Buffer.from(session.iv, 'utf8'),
  );
  const normalized = ciphertextB64.replace(/\s/g, '+');
  return Buffer.concat([decipher.update(normalized, 'base64'), decipher.final()]).toString('utf8');
};

export const rsaEncrypt = (session: Session, plaintext: string): string =>
  publicEncrypt(
    { key: session.publicKey, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(plaintext, 'utf8'),
  ).toString('base64');

// URL params are AES-encrypted; recover the plaintext, then RSA-encrypt for the API.
export const encryptParam = (session: Session, urlValue: string): string =>
  rsaEncrypt(session, aesDecrypt(session, urlValue));

export const decryptResult = <T = unknown>(session: Session, ciphertextB64: string): T =>
  JSON.parse(aesDecrypt(session, ciphertextB64)) as T;

export const encryptJson = (session: Session, payload: unknown): string => {
  const cipher = createCipheriv(
    'aes-128-cbc',
    Buffer.from(session.key, 'utf8'),
    Buffer.from(session.iv, 'utf8'),
  );
  return Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]).toString(
    'base64',
  );
};
