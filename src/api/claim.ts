import { fetchWithSign, negotiateSession } from '../http/client.js';
import { decryptResult, encryptParam, generateUuid } from '../crypto/cipher.js';

export const getClaimDetail = async <T = unknown>(
  claimNo: string,
  employeeId: string,
  olClaimNo = '',
): Promise<T> => {
  const uuid = generateUuid();
  const session = await negotiateSession(uuid);

  const { result } = await fetchWithSign<{ result: string }>('/appwechat/claim/detail', {
    claimNo: encryptParam(session, claimNo),
    employeeId: encryptParam(session, employeeId),
    language: 'zh_cn',
    olClaimNo,
    uuid,
  });

  return decryptResult<T>(session, result);
};
