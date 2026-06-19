import { fetchWithSign } from '../client.js';

export interface Person {
  customID: string;
  insuredID: string;
  insuredCName: string;
  insuredEName: string;
  insuredFullCName: string;
  sex: string;
  birthday: string;
  idTypeName: string;
  idNumber: string;
  relationship: string;
  employeeId: string;
  grpContNo: string;
  grpPlanCode: string;
  [key: string]: unknown;
}

export const RELATIONSHIP: Record<string, string> = {
  '01': '本人',
  '02': '配偶',
  '03': '子女',
  '04': '父母',
};

export const getPersons = async (employeeId: string): Promise<Person[]> => {
  const { success, result, msg } = await fetchWithSign<{
    success: string;
    result: Person[];
    msg?: string;
  }>('/appwechat/com/separated/getPersonalInfo', {
    employeeID: employeeId,
    usernameType: '01',
  });

  if (success !== 't') {
    throw new Error(`getPersons failed: ${msg || success}`);
  }
  return result;
};
