import { fetchWithSign, negotiateSession } from '../http/client.js';
import { decryptResult, encryptParam, generateUuid, rsaEncrypt } from '../crypto/cipher.js';

export interface Rider {
  riderType: string;
  riderPath: string;
  riderTypeName: string;
  riderTypeNameEn: string;
}

export interface BankAccount {
  payee: string;
  bankName: string;
  accNo: string;
  swiftCode: string;
  bankAddress: string;
  isCNYStr: string;
}

export interface InsuredInfo {
  insuredFullCName: string;
  insuredEName: string;
  sex: string;
  birthday: string;
  idTypeName: string;
  idNumber: string;
  nationality: string;
  occupation: string;
  mph: string;
  email: string;
  address: string;
  validityOfCertificate: string;
  grpContNo: string;
  grpPlanCode: string;
  [key: string]: unknown;
}

export interface ClaimDetail {
  claimNo: string;
  olClaimNo: string;
  statusName: string;
  batchNo: string;
  applyDate: string;
  checkDate: string;
  receiveDate: string;
  payDate: string;
  policyYear: string;
  insuredName: string;
  startDate: string;
  endDate: string;
  claimTypeName: string;
  hChineseName: string;
  hEnglishName: string;
  countryOfHospitail: string;
  sickness: string;
  invoiceCurrency: string;
  invoiceAmount: string;
  currency: string;
  payAmount: string;
  selfPay: string;
  deductible: string;
  discountamount: string;
  invoiceNumber: string;
  riderInfoReturn: Rider[];
  claimAccInfoReturns: BankAccount[];
  insuredInfoReturn: InsuredInfo;
  [key: string]: unknown;
}

// claimNo comes from the list as plaintext (RSA-encrypted directly); employeeId
// comes from the list AES-encrypted (recovered then RSA-encrypted via encryptParam).
export const getClaimDetail = async (
  claimNo: string,
  employeeId: string,
  olClaimNo = '',
): Promise<ClaimDetail> => {
  const uuid = generateUuid();
  const session = await negotiateSession(uuid);

  const { result } = await fetchWithSign<{ result: string }>('/appwechat/claim/detail', {
    claimNo: rsaEncrypt(session, claimNo),
    employeeId: encryptParam(session, employeeId),
    language: 'zh_cn',
    olClaimNo,
    uuid,
  });

  return decryptResult<ClaimDetail>(session, result);
};
